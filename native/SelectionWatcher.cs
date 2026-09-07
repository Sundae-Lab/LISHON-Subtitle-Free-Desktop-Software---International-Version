using System.Runtime.InteropServices;
using System.Windows.Automation;
using System.Diagnostics;
using System.Text.Json;

// React to a completed selection gesture; never periodically inject copy.
static class SelectionWatcher
{
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT point);
    [DllImport("user32.dll")] static extern uint GetClipboardSequenceNumber();
    [DllImport("user32.dll",SetLastError=true)] static extern bool OpenClipboard(IntPtr owner);
    [DllImport("user32.dll")] static extern IntPtr GetOpenClipboardWindow();
    [DllImport("user32.dll")] static extern bool CloseClipboard();
    [DllImport("user32.dll")] static extern IntPtr GetClipboardData(uint format);
    [DllImport("kernel32.dll")] static extern IntPtr GlobalLock(IntPtr handle);
    [DllImport("kernel32.dll")] static extern bool GlobalUnlock(IntPtr handle);
    [DllImport("kernel32.dll")] static extern UIntPtr GlobalSize(IntPtr handle);
    [DllImport("user32.dll", SetLastError=true)] static extern uint SendInput(uint count, INPUT[] input, int size);
    [StructLayout(LayoutKind.Sequential)] struct POINT { public int X,Y; }
    [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public INPUTUNION data; }
    [StructLayout(LayoutKind.Explicit)] struct INPUTUNION {
        [FieldOffset(0)] public KEYBDINPUT keyboard;
        [FieldOffset(0)] public MOUSEINPUT mouse;
    }
    [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort key,scan; public uint flags,time; public UIntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int x,y; public uint data,flags,time; public UIntPtr extra; }
    record SelectionRead(string Text, bool Password);
    static bool Down(int key)=>(GetAsyncKeyState(key)&0x8000)!=0;
    static string Selected(AutomationElement? element) {
        if(element==null || element.Current.IsPassword || element.Current.IsOffscreen)return "";
        if(!element.TryGetCurrentPattern(TextPattern.Pattern,out var p))return "";
        return string.Join("\n",((TextPattern)p).GetSelection().Select(r=>r.GetText(5000))).Trim();
    }
    static SelectionRead ReadSelection(IntPtr hwnd, POINT cursor) {
        try {
            var focus=AutomationElement.FocusedElement;
            if(focus?.Current.IsPassword==true)return new("",true);
            string text=Selected(focus);
            if(text.Length>0)return new(text,false);
            var under=AutomationElement.FromPoint(new System.Windows.Point(cursor.X,cursor.Y));
            // Text may be in the ancestor Document even when the focused node has an empty TextPattern.
            for(int i=0;i<7 && under!=null;i++) {
                if(under.Current.IsPassword)return new("",true);
                text=Selected(under);if(text.Length>0)return new(text,false);
                under=TreeWalker.ControlViewWalker.GetParent(under);
            }
        } catch { /* Closed window / unsupported accessibility provider. */ }
        return new("",false);
    }
    public static void Probe(string[] args,Action<object> emit) {
        var result=ReadSelection(new IntPtr(long.Parse(args[1])),new POINT{X=int.Parse(args[2]),Y=int.Parse(args[3])});
        emit(new {text=result.Text,password=result.Password});
    }
    static string IsolatedSelection(IntPtr window,POINT cursor) {
        // Some Chromium/UIAutomation providers fault inside unmanaged GetText (0xC0000005).
        // Keep that optional fallback outside the gesture watcher so it cannot kill capture.
        try {
            var info=new ProcessStartInfo(Environment.ProcessPath!){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
            foreach(var arg in new[]{"selection-once",window.ToInt64().ToString(),cursor.X.ToString(),cursor.Y.ToString()})info.ArgumentList.Add(arg);
            using var process=Process.Start(info)!;
            var output=process.StandardOutput.ReadToEndAsync();var errors=process.StandardError.ReadToEndAsync();
            if(!process.WaitForExit(650)){process.Kill(true);return "";}
            if(process.ExitCode!=0)return "";
            using var json=JsonDocument.Parse(output.GetAwaiter().GetResult());
            return json.RootElement.GetProperty("password").GetBoolean()?"":json.RootElement.GetProperty("text").GetString()??"";
        }catch{return "";}
    }
    static INPUT Key(ushort key,bool up=false)=>new(){type=1,data=new(){keyboard=new(){key=key,flags=up?2u:0u}}};
    static string CopySelection(IntPtr window) {
        if(window!=GetForegroundWindow() || Down(1)||Down(18)||Down(91)||Down(92)||Down(67))return "";
        var before=GetClipboardSequenceNumber();
        bool ctrl=Down(17);
        INPUT[] keys=ctrl?[Key(67),Key(67,true)]:[Key(17),Key(67),Key(67,true),Key(17,true)];
        if(SendInput((uint)keys.Length,keys,Marshal.SizeOf<INPUT>())!=(uint)keys.Length)return "";
        for(int i=0;i<80;i++) {
            Thread.Sleep(25);
            if(window!=GetForegroundWindow())return "";
            if(Environment.GetEnvironmentVariable("LINGUA_NATIVE_DEBUG")=="1"&&i%8==0)Console.Error.WriteLine($"clipboard sequence {before} -> {GetClipboardSequenceNumber()}");
            if(GetClipboardSequenceNumber()==before)continue;
            if(!OpenClipboard(IntPtr.Zero)){if(Environment.GetEnvironmentVariable("LINGUA_NATIVE_DEBUG")=="1"&&i%8==0)Console.Error.WriteLine($"clipboard locked {Marshal.GetLastWin32Error()} owner {GetOpenClipboardWindow()}");continue;}
            try {
                var handle=GetClipboardData(13);if(Environment.GetEnvironmentVariable("LINGUA_NATIVE_DEBUG")=="1")Console.Error.WriteLine($"clipboard handle {handle}, bytes {GlobalSize(handle)}");if(handle==IntPtr.Zero)continue;
                var pointer=GlobalLock(handle);if(pointer==IntPtr.Zero)continue;
                try {
                    int length=(int)Math.Min(5001,GlobalSize(handle).ToUInt64()/2);
                    var copied=(Marshal.PtrToStringUni(pointer,length)??"").Split('\0')[0].Trim();
                    if(copied.Length>0)return copied;
                }finally{GlobalUnlock(handle);}
            }finally{CloseClipboard();}
        }
        return "";
    }
    public static void Watch(uint excludedPid,Action<object> emit) {
        bool wasDown=false;POINT start=default;IntPtr startWindow=IntPtr.Zero;
        long releasedAt=0;IntPtr lastReleaseWindow=IntPtr.Zero;POINT lastRelease=default;
        emit(new {eventName="watch-ready"});
        while(true) {
            Thread.Sleep(25);
            bool down=Down(1);
            if(down&&!wasDown){GetCursorPos(out start);startWindow=GetForegroundWindow();}
            if(!down&&wasDown) {
                GetCursorPos(out var end);var window=GetForegroundWindow();
                GetWindowThreadProcessId(window,out uint pid);
                bool gesture=Math.Abs(end.X-start.X)+Math.Abs(end.Y-start.Y)>4 || (window==lastReleaseWindow&&Environment.TickCount64-releasedAt<500&&Math.Abs(end.X-lastRelease.X)+Math.Abs(end.Y-lastRelease.Y)<8) || Down(16);
                releasedAt=Environment.TickCount64;lastReleaseWindow=window;lastRelease=end;
                if(Environment.GetEnvironmentVariable("LINGUA_NATIVE_DEBUG")=="1")emit(new {eventName="gesture",pid,excludedPid,gesture,startX=start.X,startY=start.Y,endX=end.X,endY=end.Y,sameWindow=window==startWindow});
                if(window!=IntPtr.Zero&&window==startWindow&&pid!=excludedPid&&gesture) {
                    Thread.Sleep(100);
                    if(window!=GetForegroundWindow()||Down(1)){wasDown=down;continue;}
                    string text=CopySelection(window);string method="copy";
                    if(text.Length==0){text=IsolatedSelection(window,end);method="accessibility";}
                    if(Environment.GetEnvironmentVariable("LINGUA_NATIVE_DEBUG")=="1")emit(new {eventName="read",length=text.Length,method,stillForeground=window==GetForegroundWindow()});
                    if(window!=GetForegroundWindow()||Down(1)){wasDown=down;continue;}
                    if(text.Length>0) {
                        emit(new {text=text[..Math.Min(5000,text.Length)],method});
                    }
                }
            }
            wasDown=down;
        }
    }
}
