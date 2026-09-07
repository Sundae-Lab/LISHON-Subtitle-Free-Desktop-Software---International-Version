using System.Runtime.InteropServices;
using System.Text.Json;

// Native blur samples only windows behind this HWND; subtitles remain capturable.
// Accent 3 has no tint: the renderer is the sole owner of background color/alpha.
static class MaterialHost {
 [StructLayout(LayoutKind.Sequential)] struct Accent {public int State,Flags;public uint Color;public int Animation;}
 [StructLayout(LayoutKind.Sequential)] struct Data {public int Attribute;public IntPtr Pointer;public int Size;}
 [StructLayout(LayoutKind.Sequential)] struct Rect {public int Left,Top,Right,Bottom;}
 [DllImport("user32.dll")]static extern bool SetWindowCompositionAttribute(IntPtr hwnd,ref Data data);
 [DllImport("user32.dll")]static extern bool GetWindowRect(IntPtr hwnd,out Rect rect);
 [DllImport("gdi32.dll")]static extern IntPtr CreateRoundRectRgn(int l,int t,int r,int b,int w,int h);
 [DllImport("gdi32.dll")]static extern bool DeleteObject(IntPtr obj);
 [DllImport("user32.dll")]static extern int SetWindowRgn(IntPtr hwnd,IntPtr region,bool redraw);
 [DllImport("dwmapi.dll")]static extern int DwmSetWindowAttribute(IntPtr hwnd,int attribute,ref int value,int size);
 [DllImport("user32.dll")]static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 public static void Run(IntPtr hwnd) {
  SetThreadDpiAwarenessContext(new IntPtr(-4));
  // HRGN only clips the Chromium surface, not ACCENT's DWM backdrop. On Windows
  // 11 the DWM corner mask must own clipping of BOTH layers. A non-null HRGN
  // disables that mask, so never reinstall one during resizing on this path.
  int corner=1;DwmSetWindowAttribute(hwnd,33,ref corner,4);
  bool nativeCornerSupport=Environment.OSVersion.Version.Build>=22000;
  int noBorder=-2;DwmSetWindowAttribute(hwnd,34,ref noBorder,4);
  bool? lastBlur=null,lastNativeClip=null;bool warned=false;
  int lastWidth=-1,lastHeight=-1,lastRadius=-1;
  string? line;while((line=Console.ReadLine())!=null)try{
   using var doc=JsonDocument.Parse(line);var root=doc.RootElement;
   bool blur=root.TryGetProperty("blur",out var enabled)&&enabled.GetBoolean();
   bool nativeCorners=blur&&nativeCornerSupport;
   bool clipChanged=lastNativeClip!=nativeCorners;
   if(clipChanged){
    if(nativeCorners)SetWindowRgn(hwnd,IntPtr.Zero,false);
    corner=nativeCorners?2:1;
    if(DwmSetWindowAttribute(hwnd,33,ref corner,4)!=0&&nativeCorners){nativeCornerSupport=false;nativeCorners=false;}
    lastNativeClip=nativeCorners;
   }
   bool applyBlur=blur&&nativeCorners;
   if(lastBlur!=applyBlur){
    var accent=new Accent{State=applyBlur?3:0};var ptr=Marshal.AllocHGlobal(Marshal.SizeOf<Accent>());
    try{Marshal.StructureToPtr(accent,ptr,false);var data=new Data{Attribute=19,Pointer=ptr,Size=Marshal.SizeOf<Accent>()};if(!SetWindowCompositionAttribute(hwnd,ref data))throw new Exception("Windows 系统磨砂不可用");lastBlur=applyBlur;}finally{Marshal.FreeHGlobal(ptr);}
   }
   GetWindowRect(hwnd,out var rect);rect.Right-=rect.Left;rect.Bottom-=rect.Top;int radius=root.TryGetProperty("radius",out var r)?r.GetInt32():24;
   int regionResult=1;
   if(!nativeCorners&&(clipChanged||lastWidth!=rect.Right||lastHeight!=rect.Bottom||lastRadius!=radius)){
    var region=CreateRoundRectRgn(0,0,rect.Right,rect.Bottom,radius,radius);
    regionResult=SetWindowRgn(hwnd,region,false);if(regionResult==0)DeleteObject(region);
    lastWidth=rect.Right;lastHeight=rect.Bottom;lastRadius=radius;
   }
   string? warning=blur&&!nativeCorners&&!warned?"当前系统不支持圆角系统磨砂，已保留圆角透明背景。关闭“允许截图与录屏”后可使用精细磨砂。":null;
   if(warning!=null)warned=true;if(!blur)warned=false;
   Console.WriteLine(JsonSerializer.Serialize(new{ok=regionResult!=0,regionResult,width=rect.Right,height=rect.Bottom,radius,blur=applyBlur,nativeCorners,warning}));Console.Out.Flush();
  }catch(Exception e){Console.WriteLine(JsonSerializer.Serialize(new{error=e.Message}));Console.Out.Flush();}
 }
}
