/**
 * ヘリ医師記録フォルダ内アプリ連携定義
 * StrokeNotify / heli_record から相互参照
 */
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
