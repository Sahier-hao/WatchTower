/** 检测是否在微信内打开 */
export function isWechat(): boolean {
  return /micromessenger/i.test(navigator.userAgent);
}

/** 微信内打开链接（绕过 target=_blank 限制） */
export function openLink(url: string, e?: React.MouseEvent) {
  if (isWechat()) {
    e?.preventDefault();
    window.location.href = url;
  }
}
