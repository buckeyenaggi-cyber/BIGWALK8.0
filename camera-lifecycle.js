// 旧相机模式的收尾，退出了就把相机关掉
window.installBeaconCameraLifecycle = function(AFRAME){
  // 旧的识别图模式单独开相机，这里也要一起关
  const sourcePrototype=window.BeaconArToolkitSource?.prototype;
  if(sourcePrototype&&!sourcePrototype.beaconLifecycle){
    sourcePrototype.beaconLifecycle=true;
    const disposeSource=sourcePrototype.dispose;
    sourcePrototype._initSourceWebcam=function(onReady,onError){
      const source=this,video=document.createElement('video');this.beaconSourceActive=true;
      video.autoplay=true;video.muted=true;video.playsInline=true;
      const fail=error=>{if(!source.beaconSourceActive)return;window.dispatchEvent(new CustomEvent('beacon-camera-error',{detail:{message:error.message||'Allow camera access in your browser.'}}));};
      if(!navigator.mediaDevices?.getUserMedia){queueMicrotask(()=>fail(new Error('Open the HTTPS site to use the camera.')));return video;}
      navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}}).then(async stream=>{
        if(!source.beaconSourceActive){stream.getTracks().forEach(track=>track.stop());return;}
        video.srcObject=stream;
        await new Promise(resolve=>{if(video.readyState>=1)resolve();else video.addEventListener('loadedmetadata',resolve,{once:true});});
        if(!source.beaconSourceActive){stream.getTracks().forEach(track=>track.stop());return;}
        await video.play();if(!source.beaconSourceActive)return;
        onReady();document.getElementById('camera-layer').appendChild(video);
      }).catch(fail);
      return video;
    };
    sourcePrototype.dispose=function(){
      this.beaconSourceActive=false;
      this.domElement?.srcObject?.getTracks().forEach(track=>track.stop());
      if(this.domElement)this.domElement.srcObject=null;
      disposeSource.call(this);
    };
  }
  const prototype=AFRAME.components['arjs-webcam-texture']?.Component?.prototype;
  if(!prototype||prototype.beaconLifecycle)return;
  prototype.beaconLifecycle=true;
  const init=prototype.init;
  if(init)prototype.init=function(){
    init.call(this);this.video.id='arjs-video';this.video.muted=true;
    this.video.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none';
    document.getElementById('camera-layer').appendChild(this.video);
    this.scene.renderer.autoClear=true;this.scene.object3D.background=null;
  };
  // 相机画面保持原来的比例，别拉变形
  prototype.tick=function(){};
  const remove=prototype.remove;
  prototype.play=function(){
    const token=this.beaconMediaToken=(this.beaconMediaToken||0)+1;
    this.beaconMediaActive=true;
    if(!navigator.mediaDevices?.getUserMedia){this.el.sceneEl.systems.arjs._displayErrorPopup('Camera access is not supported. Use an HTTPS page.');return;}
    navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(stream=>{
      if(!this.beaconMediaActive||token!==this.beaconMediaToken||!this.el.isConnected){stream.getTracks().forEach(track=>track.stop());return;}
      this.video.srcObject=stream;this.video.play().catch(()=>{});
    }).catch(error=>{if(this.beaconMediaActive&&this.el.isConnected)this.el.sceneEl.systems.arjs._displayErrorPopup(`Webcam error: ${error.message||error}`);});
  };
  prototype.pause=function(){
    this.beaconMediaActive=false;this.beaconMediaToken=(this.beaconMediaToken||0)+1;
    this.video?.srcObject?.getTracks().forEach(track=>track.stop());
    if(this.video)this.video.srcObject=null;
  };
  prototype.remove=function(){this.pause();this.video?.remove();remove.call(this);};
};
