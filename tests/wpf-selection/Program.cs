using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Interop;
class Fixture {
 [STAThread]static void Main(){
  var app=new Application();var box=new TextBox{Text="Welcome to the world.",FontSize=26,FontFamily=new FontFamily("Arial"),Height=85,Margin=new Thickness(35),Padding=new Thickness(10),VerticalContentAlignment=VerticalAlignment.Center};
  var win=new Window{Title="Lishon selection fixture — WPF",Width=850,Height=260,Content=box,Topmost=true};
  win.Loaded+=async(_,_)=>{await Task.Delay(1000);win.Activate();box.Focus();var first=box.GetRectFromCharacterIndex(0);var last=box.GetRectFromCharacterIndex(box.Text.Length-1,true);Point start=box.PointToScreen(new Point(first.Left,first.Top+first.Height/2)),end=box.PointToScreen(new Point(last.Right+3,last.Top+last.Height/2));Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new{hwnd=new WindowInteropHelper(win).Handle.ToInt64().ToString(),start=new{x=(int)start.X,y=(int)start.Y},end=new{x=(int)end.X,y=(int)end.Y}}));Console.Out.Flush();};app.Run(win);
 }
}
