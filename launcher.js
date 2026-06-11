const {execFile}=require('child_process');
const path=require('path');
const vbs=path.join(__dirname,'iniciar_oculto.vbs');
execFile('wscript.exe',[vbs],{detached:true,windowsHide:true});
setTimeout(()=,500);