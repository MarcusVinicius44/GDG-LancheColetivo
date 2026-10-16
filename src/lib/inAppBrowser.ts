// Google bloqueia OAuth em webviews (WhatsApp/Instagram/Facebook...): erro 403 disallowed_useragent.
const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|Messenger|Snapchat|TikTok|MicroMessenger|LinkedInApp|Twitter/i

export function isInAppBrowser(userAgent: string = navigator.userAgent): boolean {
  return IN_APP.test(userAgent)
}
