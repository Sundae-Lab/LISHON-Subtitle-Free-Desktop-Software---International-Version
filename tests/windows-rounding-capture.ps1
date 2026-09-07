param([long]$WindowHandle,[string]$OutputPath,[string]$ReferencePath='')
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;using System.Runtime.InteropServices;
public static class RoundCheck {
 [StructLayout(LayoutKind.Sequential)] public struct Rect {public int L,T,R,B;}
 [StructLayout(LayoutKind.Sequential)] public struct Blur {public uint Flags;public bool Enable;public IntPtr Region;public bool Transition;}
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr w,out Rect r);
 [DllImport("user32.dll")] public static extern int GetWindowRgn(IntPtr w,IntPtr r);
 [DllImport("gdi32.dll")] public static extern IntPtr CreateRectRgn(int a,int b,int c,int d);
 [DllImport("gdi32.dll")] public static extern IntPtr CreateRoundRectRgn(int a,int b,int c,int d,int rx,int ry);
 [DllImport("gdi32.dll")] public static extern bool PtInRegion(IntPtr r,int x,int y);
 [DllImport("gdi32.dll")] public static extern bool DeleteObject(IntPtr r);
 [DllImport("user32.dll")] public static extern long GetWindowLongPtr(IntPtr w,int i);
 [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr w);
 [DllImport("user32.dll")] public static extern bool GetWindowDisplayAffinity(IntPtr w,out uint a);
 [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr c);
}
"@
[RoundCheck]::SetThreadDpiAwarenessContext([IntPtr](-4))|Out-Null
$handle=[IntPtr]$WindowHandle
$r=[RoundCheck+Rect]::new();[RoundCheck]::GetWindowRect($handle,[ref]$r)|Out-Null
$width=$r.R-$r.L;$height=$r.B-$r.T;$dpi=[RoundCheck]::GetDpiForWindow($handle);$radius=[int](32*$dpi/96)
$reg=[RoundCheck]::CreateRectRgn(0,0,0,0);$kind=[RoundCheck]::GetWindowRgn($handle,$reg)
$corners=@([RoundCheck]::PtInRegion($reg,1,1),[RoundCheck]::PtInRegion($reg,$width-2,1),[RoundCheck]::PtInRegion($reg,1,$height-2),[RoundCheck]::PtInRegion($reg,$width-2,$height-2));[RoundCheck]::DeleteObject($reg)|Out-Null
[uint32]$affinity=0;[RoundCheck]::GetWindowDisplayAffinity($handle,[ref]$affinity)|Out-Null
$bitmap=[System.Drawing.Bitmap]::new($width,$height);$g=[System.Drawing.Graphics]::FromImage($bitmap)
$differences=@();$unblurred=$true
try{$g.CopyFromScreen($r.L,$r.T,0,0,[System.Drawing.Size]::new($width,$height));$bitmap.Save($OutputPath,[System.Drawing.Imaging.ImageFormat]::Png)
 if($ReferencePath){$reference=[System.Drawing.Bitmap]::FromFile($ReferencePath);try{
 foreach($cornerIndex in 0..3){$delta=0;foreach($dx in 0..2){foreach($dy in 0..2){$px=if($cornerIndex -band 1){$width-1-$dx}else{$dx};$py=if($cornerIndex -band 2){$height-1-$dy}else{$dy};$a=$bitmap.GetPixel($px,$py);$b=$reference.GetPixel($px,$py);if(($b.R -gt 240 -and $a.R -lt 145) -or ($b.R -lt 24 -and $a.R -gt 40)){$unblurred=$false};$delta=[Math]::Max($delta,[Math]::Max([Math]::Abs([int]$a.R-[int]$b.R),[Math]::Max([Math]::Abs([int]$a.G-[int]$b.G),[Math]::Abs([int]$a.B-[int]$b.B))))}};$differences+=,$delta}
 }finally{$reference.Dispose()}}
}finally{$g.Dispose();$bitmap.Dispose()}
@{unblurredCorners=$unblurred;cornerDifferences=$differences;style=[RoundCheck]::GetWindowLongPtr($handle,-16);exStyle=[RoundCheck]::GetWindowLongPtr($handle,-20);region=$kind;corners=$corners;dpi=$dpi;width=$width;height=$height;affinity=$affinity}|ConvertTo-Json -Compress
