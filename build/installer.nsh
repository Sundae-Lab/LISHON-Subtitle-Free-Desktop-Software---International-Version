!include nsDialogs.nsh
!include LogicLib.nsh
!include MUI2.nsh
!define LISHON_MODEL_READER "${__FILEDIR__}\read-model-path.ps1"
!define LISHON_MODEL_INSTALLER "${__FILEDIR__}\install-bundled-models.ps1"
!define LISHON_BUNDLED_MODELS "${__FILEDIR__}\bundled-models.7z"
BrandingText "北京 MAIS·AI 工作室"

!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!ifndef BUILD_UNINSTALLER
Var ModelDirectory
Var InitialModelDirectory
Var ModelDirectoryInput
Var ModelPageDialog
Var ModelErrorLabel

!macro customInit
  StrCpy $ModelDirectory "$APPDATA\lishon-international\models"
  InitPluginsDir
  File /oname=$PLUGINSDIR\lishon-read-model-path.ps1 "${LISHON_MODEL_READER}"
  nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\lishon-read-model-path.ps1" -OutputPath "$PLUGINSDIR\lishon-model-path.txt"'
  Pop $0
  Pop $1
  ${If} $0 == "0"
    FileOpen $0 "$PLUGINSDIR\lishon-model-path.txt" r
    FileSeek $0 2 SET
    FileReadUTF16LE $0 $ModelDirectory
    FileClose $0
  ${EndIf}
  StrCpy $InitialModelDirectory $ModelDirectory
!macroend

!macro customPageAfterChangeDir
  Page custom ModelDirectoryPage ModelDirectoryLeave
!macroend

Function ModelDirectoryPage
  !insertmacro MUI_HEADER_TEXT "语言包存放位置" "翻译和语音识别模型随软件安装，无需另行下载。"
  nsDialogs::Create 1018
  Pop $ModelPageDialog
  ${If} $ModelPageDialog == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 10u 100% 22u "8 种语言的英语双向翻译包，以及共用语音识别包。"
  Pop $0
  ${NSD_CreateDirRequest} 0 40u 78% 14u "$ModelDirectory"
  Pop $ModelDirectoryInput
  ${NSD_CreateBrowseButton} 81% 39u 19% 16u "选择…"
  Pop $0
  ${NSD_OnClick} $0 BrowseModelDirectory
  ${NSD_CreateLabel} 0 70u 100% 30u "已有语言包默认保留原位置。选择新目录不会搬移或删除旧文件。"
  Pop $0
  SetCtlColors $0 777777 transparent
  ${NSD_CreateLabel} 0 111u 100% 32u ""
  Pop $ModelErrorLabel
  SetCtlColors $ModelErrorLabel B42318 transparent
  nsDialogs::Show
FunctionEnd

Function BrowseModelDirectory
  Pop $0
  ${NSD_GetText} $ModelDirectoryInput $ModelDirectory
  nsDialogs::SelectFolderDialog "选择语言包下载目录" "$ModelDirectory"
  Pop $0
  ${If} $0 != error
    ${NSD_SetText} $ModelDirectoryInput $0
    ${NSD_SetText} $ModelErrorLabel ""
  ${EndIf}
FunctionEnd

Function ModelDirectoryLeave
  ${NSD_GetText} $ModelDirectoryInput $ModelDirectory
  ${If} $ModelDirectory == ""
    ${NSD_SetText} $ModelErrorLabel "请选择语言包目录。"
    Abort
  ${EndIf}
  GetFullPathName $ModelDirectory $ModelDirectory
  GetFullPathName $1 $INSTDIR
  StrLen $2 $1
  StrCpy $3 $ModelDirectory $2
  ${If} $3 == $1
    StrCpy $4 $ModelDirectory 1 $2
    ${If} $4 == ""
    ${OrIf} $4 == "\"
      ${NSD_SetText} $ModelErrorLabel "语言包请单独存放在软件安装目录之外。"
      Abort
    ${EndIf}
  ${EndIf}
  ClearErrors
  CreateDirectory "$ModelDirectory"
  GetTempFileName $0 "$ModelDirectory"
  ${If} ${Errors}
    ${NSD_SetText} $ModelErrorLabel "此目录无法写入，请选择其他位置。"
    Abort
  ${EndIf}
  Delete "$0"
FunctionEnd

!macro customInstall
  DetailPrint "正在安装内置语言包，请稍候…"
  SetCompress off
  File /oname=$PLUGINSDIR\lishon-models.7z "${LISHON_BUNDLED_MODELS}"
  SetCompress auto
  SetOutPath "$PLUGINSDIR\lishon-bundled-models"
  Nsis7z::Extract "$PLUGINSDIR\lishon-models.7z"
  File /oname=$PLUGINSDIR\lishon-install-models.ps1 "${LISHON_MODEL_INSTALLER}"
  FileOpen $0 "$PLUGINSDIR\lishon-chosen-model-path.txt" w
  FileWriteUTF16LE $0 "$ModelDirectory"
  FileClose $0
  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -WindowStyle Hidden -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\lishon-install-models.ps1" -SourceRoot "$PLUGINSDIR\lishon-bundled-models" -DestinationFile "$PLUGINSDIR\lishon-chosen-model-path.txt" -LogPath "$APPDATA\lishon-international\installer-models.log"' $0
  ${If} $0 != "0"
    MessageBox MB_ICONSTOP|MB_OK "语言包安装未完成。请确认所选目录可写、磁盘空间充足，然后重新运行安装程序。已有模型已保留。"
    SetErrorLevel 2
    Abort
  ${EndIf}
  SetOutPath "$INSTDIR"
  ${If} $ModelDirectory != $InitialModelDirectory
  ${OrIfNot} ${FileExists} "$APPDATA\lishon-international\settings.json"
    CreateDirectory "$APPDATA\lishon-international"
    FileOpen $0 "$APPDATA\lishon-international\installer-model-path.txt" w
    FileWriteUTF16LE $0 "$ModelDirectory"
    FileClose $0
  ${EndIf}
!macroend
!endif

