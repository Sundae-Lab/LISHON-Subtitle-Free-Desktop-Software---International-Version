using System.Runtime.InteropServices;
using System.Text;
class Driver {
 [DllImport("user32.dll")]static extern bool SetProcessDpiAwarenessContext(IntPtr value);
 [DllImport("user32.dll")]static extern bool SetForegroundWindow(IntPtr hwnd);
 [DllImport("user32.dll")]static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")]static extern int GetWindowText(IntPtr hwnd,StringBuilder text,int max);
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr hwnd,IntPtr pid);
 [DllImport("kernel32.dll")]static extern uint GetCurrentThreadId();
 [DllImport("user32.dll")]static extern bool AttachThreadInput(uint a,uint b,bool attach);
 [DllImport("user32.dll")]static extern bool BringWindowToTop(IntPtr hwnd);
 [DllImport("user32.dll")]static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")]static extern bool GetCursorPos(out POINT point);
 [DllImport("user32.dll")]static extern uint SendInput(uint count,INPUT[] inputs,int size);
 [StructLayout(LayoutKind.Sequential)]struct POINT{public int X,Y;}
 [StructLayout(LayoutKind.Sequential)]struct INPUT{public uint type;public MOUSE data;}
 [StructLayout(LayoutKind.Sequential)]struct MOUSE{public int x,y;public uint data,flags,time;public UIntPtr extra;}
 static void Mouse(uint flags){var inputs=new[]{new INPUT{type=0,data=new(){flags=flags}}};if(SendInput(1,inputs,Marshal.SizeOf<INPUT>())!=1)throw new Exception("SendInput failed");}
 static int Main(string[] args){
  SetProcessDpiAwarenessContext(new IntPtr(-4));
  var hwnd=new IntPtr(long.Parse(args[0]));var title=new StringBuilder(256);GetWindowText(hwnd,title,256);
  // Never inject into an arbitrary user window. The harness only accepts our disposable fixture.
  if(!title.ToString().StartsWith("Lishon selection fixture"))throw new Exception("Not a test fixture");
  var foreground=GetForegroundWindow();uint a=GetCurrentThreadId(),b=GetWindowThreadProcessId(foreground,IntPtr.Zero);
  AttachThreadInput(a,b,true);try{BringWindowToTop(hwnd);SetForegroundWindow(hwnd);}finally{AttachThreadInput(a,b,false);}
  Thread.Sleep(150);if(GetForegroundWindow()!=hwnd)throw new Exception("Fixture could not acquire foreground; no input injected");
  GetCursorPos(out var original);
  try{int x=int.Parse(args[1]),y=int.Parse(args[2]),endX=int.Parse(args[3]),endY=int.Parse(args[4]);SetCursorPos(x,y);Thread.Sleep(80);Mouse(2);
   for(int i=1;i<=20;i++){if(GetForegroundWindow()!=hwnd)break;SetCursorPos(x+(endX-x)*i/20,y+(endY-y)*i/20);Thread.Sleep(20);}
   Mouse(4);Thread.Sleep(800);Console.WriteLine("drag complete");
  }finally{SetCursorPos(original.X,original.Y);}
  return 0;
 }
}
