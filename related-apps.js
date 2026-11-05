



window.APP_RELATIONS = {
  heli_record: {
    id: 'heli_record',
    label: 'ドクターヘリ活動記録',
    href: './index.html',
    strokeNotifyHref: './StrokeNotify_v1.0.html'
  },
  stroke_notify: {
    id: 'stroke_notify',
    label: '脳卒中班連絡',
    href: './StrokeNotify_v1.0.html'
  }
};

window.refreshRecordApp = async function() {
  if(location.protocol === 'file:') { location.reload(); return; }
  try {
    if(!navigator.onLine) throw Error();
    const scope = new URL('./', location.href).href;
    if('serviceWorker' in navigator) {
      let registration = await navigator.serviceWorker.getRegistration(scope);
      if(registration?.scope === scope) await registration.update();
      else registration = await navigator.serviceWorker.register(new URL('sw.js',scope));
      const worker = registration.installing || registration.waiting;
      if(worker) await new Promise((resolve,reject) => {
        const check = () => {
          if(worker.state === 'activated') resolve();
          else if(worker.state === 'redundant') reject(Error());
        };
        worker.addEventListener('statechange',check);
        check();
      });
    } else {
      const response = await fetch(new URL('index.html',scope), {method:'HEAD',cache:'no-store'});
      if(!response.ok) throw Error();
    }
    location.reload();
  } catch {
    alert('更新を確認できませんでした。現在の画面で入力を続けられます。通信回復後に再試行してください。');
  }
};
