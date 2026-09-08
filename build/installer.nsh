!include nsDialogs.nsh
!include LogicLib.nsh
!include MUI2.nsh
!include FileFunc.nsh
!define LISHON_MODEL_READER "${__FILEDIR__}\read-model-path.ps1"
!define LISHON_MODEL_INSTALLER "${__FILEDIR__}\install-bundled-models.ps1"
!define LISHON_BUNDLED_MODELS "${__FILEDIR__}\bundled-models.7z"
!define LISHON_OPTIONAL_REMOVER "${__FILEDIR__}\remove-optional-data.ps1"
!define LISHON_APP_REMOVER "${__FILEDIR__}\remove-application-files.ps1"
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
  ${GetParameters} $0
  ClearErrors
  ${GetOptions} $0 "/MODELDIR=" $1
  ${IfNot} ${Errors}
    StrCpy $ModelDirectory $1
  ${EndIf}
!macroend

!macro customPageAfterChangeDir
  ; electron-builder normally appends the product name after the model page.
  ; Honor the exact folder displayed to the user, including the same-folder shortcut.
  !undef MUI_PAGE_CUSTOMFUNCTION_PRE
  !define MUI_PAGE_CUSTOMFUNCTION_PRE LishonInstallFilesPre
  Page custom ModelDirectoryPage ModelDirectoryLeave
!macroend

Function LishonInstallFilesPre
  Push $INSTDIR
  Call instFilesPre
  Pop $INSTDIR
  GetFullPathName $INSTDIR $INSTDIR
FunctionEnd

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
  ${NSD_CreateButton} 0 66u 40% 18u "与软件放在同一目录"
  Pop $0
  ${NSD_OnClick} $0 UseSoftwareDirectory
  ${NSD_CreateLabel} 0 91u 100% 34u "可与软件同目录，也可单独存放。升级和卸载仅处理软件文件，保留语言包与已有文件。"
  Pop $0
  SetCtlColors $0 777777 transparent
  ${NSD_CreateLabel} 0 129u 100% 24u ""
  Pop $ModelErrorLabel
  SetCtlColors $ModelErrorLabel B42318 transparent
  nsDialogs::Show
FunctionEnd

Function UseSoftwareDirectory
  Pop $0
  ${NSD_SetText} $ModelDirectoryInput "$INSTDIR"
  ${NSD_SetText} $ModelErrorLabel ""
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
  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -WindowStyle Hidden -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\lishon-install-models.ps1" -SourceRoot "$PLUGINSDIR\lishon-bundled-models" -DestinationFile "$PLUGINSDIR\lishon-chosen-model-path.txt" -InstallationRoot "$INSTDIR" -LogPath "$APPDATA\lishon-international\installer-models.log"' $0
  ${If} $0 != "0"
    MessageBox MB_ICONSTOP|MB_OK "语言包安装未完成。请确认所选目录可写、磁盘空间充足，然后重新运行安装程序。已有模型已保留。" /SD IDOK
    SetErrorLevel 2
    Abort
  ${EndIf}
  SetOutPath "$INSTDIR"
!macroend
!endif

; Both upgrades and uninstall use the inventory generated from packaged application files.
; Never recursively remove $INSTDIR: it may also contain models or the user's own files.
!macro customRemoveFiles
  InitPluginsDir
  File /oname=$PLUGINSDIR\lishon-remove-app.ps1 "${LISHON_APP_REMOVER}"
  SetOutPath "$TEMP"
  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -WindowStyle Hidden -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\lishon-remove-app.ps1" -InstallationRoot "$INSTDIR"' $0
  ${If} $0 != "0"
    MessageBox MB_ICONSTOP|MB_OK "软件文件正在使用或安装记录损坏。请退出软件后重试；语言包与其他文件已保留。" /SD IDOK
    SetErrorLevel 2
    Abort
  ${EndIf}
  Delete "$INSTDIR\${UNINSTALL_FILENAME}"
  Delete "$INSTDIR\uninstallerIcon.ico"
  RMDir "$INSTDIR"
!macroend


!ifdef BUILD_UNINSTALLER
Var RemoveHistory
Var RemoveModels
Var RemoveHistoryCheck
Var RemoveModelsCheck
!macro customUnInit
  StrCpy $RemoveHistory 0
  StrCpy $RemoveModels 0
!macroend
!macro customUnWelcomePage
  UninstPage custom un.DataChoices un.DataChoicesLeave
!macroend
Function un.DataChoices
  ${GetParameters} $0
  ClearErrors
  ${GetOptions} $0 "--updated" $1
  ${IfNot} ${Errors}
    Abort
  ${EndIf}
  IfSilent 0 +2
    Abort
  !insertmacro MUI_HEADER_TEXT "卸载听现国际版" "选择需要一并删除的资料。默认全部保留。"
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateLabel} 0 12u 100% 30u "不勾选时仅移除软件，保留语言模型、翻译历史与个人语库。"
  Pop $0
  ${NSD_CreateCheckbox} 0 50u 100% 20u "删除本地翻译历史文件"
  Pop $RemoveHistoryCheck
  ${NSD_CreateCheckbox} 0 82u 100% 20u "删除本安装器记录的语言与语音模型文件"
  Pop $RemoveModelsCheck
  ${NSD_CreateLabel} 0 116u 100% 42u "删除无法撤销。若其他应用共用这些模型，也会受影响。存储目录内的其他文件不会删除。"
  Pop $0
  SetCtlColors $0 777777 transparent
  nsDialogs::Show
FunctionEnd
Function un.DataChoicesLeave
  ${NSD_GetState} $RemoveHistoryCheck $RemoveHistory
  ${NSD_GetState} $RemoveModelsCheck $RemoveModels
FunctionEnd
!macro customUnInstall
  ${IfNot} ${isUpdated}
    ${If} $RemoveHistory == 1
    ${OrIf} $RemoveModels == 1
      InitPluginsDir
      File /oname=$PLUGINSDIR\lishon-remove-data.ps1 "${LISHON_OPTIONAL_REMOVER}"
      ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -WindowStyle Hidden -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\lishon-remove-data.ps1" -InstallationRoot "$INSTDIR" -UserDataRoot "$APPDATA\lishon-international" -DeleteHistory $RemoveHistory -DeleteModels $RemoveModels' $0
      ${If} $0 != 0
        MessageBox MB_ICONSTOP|MB_OK "资料清理未完成，请检查目录权限后重试。" /SD IDOK
        SetErrorLevel 2
        Abort
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend
!endif
