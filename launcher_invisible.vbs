Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c cd /d """ & Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\")) & """ && npm start", 0, False