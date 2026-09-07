using System.Drawing;
using System.Runtime.InteropServices;
using System.Windows.Forms;

// A GDI layered input surface, without a Chromium swap chain or a desktop snapshot.
// Alpha 1 keeps hit testing active while leaving the live desktop visually intact.
static class RegionPicker {
 [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 public static void Run(Action<object> emit) {
  SetThreadDpiAwarenessContext(new IntPtr(-4));
  Application.EnableVisualStyles();
  using var picker=new Surface(emit);
  Application.Run(picker);
 }
 sealed class Decoration:Form {
  public Decoration(){FormBorderStyle=FormBorderStyle.None;ShowInTaskbar=false;TopMost=true;BackColor=Color.FromArgb(137,104,232);StartPosition=FormStartPosition.Manual;}
  protected override bool ShowWithoutActivation=>true;
  protected override CreateParams CreateParams {get{var p=base.CreateParams;p.ExStyle|=0x08000020;return p;}}
 }
 sealed class Surface:Form {
  readonly Action<object> emit;readonly Decoration[] edges=Enumerable.Range(0,4).Select(_=>new Decoration()).ToArray();
  readonly System.Windows.Forms.Timer timer=new(){Interval=30};
  readonly Decoration hint=new();Point? anchor;Rectangle area;bool done;
  public Surface(Action<object> output){
   emit=output;Text="Lishon region selection";FormBorderStyle=FormBorderStyle.None;ShowInTaskbar=false;TopMost=true;StartPosition=FormStartPosition.Manual;
   Bounds=SystemInformation.VirtualScreen;BackColor=Color.Black;Opacity=1d/255;Cursor=Cursors.Cross;KeyPreview=true;
   hint.BackColor=Color.FromArgb(35,36,40);hint.Size=new Size(600,52);
   hint.Controls.Add(new Label{Dock=DockStyle.Fill,Text=Environment.GetEnvironmentVariable("LISHON_PICKER_HINT")??"Drag to select text region · Esc to cancel",TextAlign=ContentAlignment.MiddleCenter,ForeColor=Color.White,Font=new Font("Microsoft YaHei UI",11)});
   Shown+=(_,_)=>{hint.Show();timer.Start();};
   timer.Tick+=(_,_)=>{var s=Screen.FromPoint(Cursor.Position).Bounds;hint.Location=new Point(s.X+(s.Width-hint.Width)/2,s.Y+32);};
   KeyDown+=(_,e)=>{if(e.KeyCode==Keys.Escape)Finish(null);};
   MouseDown+=(_,e)=>{if(e.Button==MouseButtons.Right){Finish(null);return;}if(e.Button!=MouseButtons.Left)return;anchor=PointToScreen(e.Location);Capture=true;Trace("down",e.Location,anchor.Value);};
   MouseMove+=(_,e)=>UpdateArea(e.Location);
   MouseUp+=(_,e)=>{if(e.Button!=MouseButtons.Left||anchor==null)return;UpdateArea(e.Location);anchor=null;Capture=false;if(area.Width<60||area.Height<24)return;Finish(new{x=area.X,y=area.Y,width=area.Width,height=area.Height});};
   FormClosed+=(_,_)=>{timer.Stop();timer.Dispose();foreach(var edge in edges)edge.Dispose();hint.Dispose();if(!done)emit(new{cancelled=true});};
  }
  void UpdateArea(Point client){if(anchor is not Point a)return;var p=PointToScreen(client);var b=Screen.FromPoint(a).Bounds;
   p=new Point(Math.Clamp(p.X,b.Left,b.Right),Math.Clamp(p.Y,b.Top,b.Bottom));
   Trace("move",client,p);area=Rectangle.FromLTRB(Math.Min(a.X,p.X),Math.Min(a.Y,p.Y),Math.Max(a.X,p.X),Math.Max(a.Y,p.Y));DrawEdges();
  }
  void Trace(string phase,Point client,Point physical){if(Environment.GetEnvironmentVariable("LISHON_PICKER_DEBUG")=="1")Console.Error.WriteLine($"{phase} client={client} physical={physical} bounds={Bounds}");}
  void DrawEdges(){var r=area;Rectangle[] bounds=[new(r.Left,r.Top,Math.Max(1,r.Width),2),new(r.Left,r.Bottom-2,Math.Max(1,r.Width),2),new(r.Left,r.Top,2,Math.Max(1,r.Height)),new(r.Right-2,r.Top,2,Math.Max(1,r.Height))];for(int i=0;i<4;i++){edges[i].Bounds=bounds[i];if(!edges[i].Visible)edges[i].Show();}}
  void Finish(object? result){if(done)return;done=true;emit(result??new{cancelled=true});Close();}
 }
}
