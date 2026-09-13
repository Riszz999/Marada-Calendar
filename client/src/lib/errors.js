/**
 * แปลง error code จาก server เป็นข้อความตามภาษาที่เลือก
 * t = ฟังก์ชันแปลจาก useLang()
 * opts.throttleKey = i18n key ที่จะใช้ตอนโดน rate limit — ต่างกันตามหน้าที่เรียก
 *   (ล็อกอินแอดมินผิด กับ กรอกรหัสพนักงานผิด คนละ bucket และคนละข้อความ)
 */
export function errorMessage(err, t, opts = {}) {
  const code = err?.body?.error;
  const fields = err?.body?.fields;

  if (code === 'validation_failed' && fields) {
    if (fields.username === 'charset') return t('usernameCharsetErr');
    if (fields.username === 'length') return t('usernameLengthErr');
    if (fields.username === 'required') return t('usernameRequired');
    if (fields.password === 'too_short' || fields.newPassword === 'too_short') return t('passwordTooShort');
    if (fields.key) return t('staffKeyTooShort');
    return t('saveError');
  }

  switch (code) {
    case 'invalid_credentials': return t('loginFailed');
    case 'invalid_key': return t('staffKeyInvalid');
    case 'invalid_current_password': return t('currentPasswordWrong');
    case 'username_taken': return t('usernameTaken');
    case 'nothing_to_update': return t('nothingToUpdate');
    case 'cannot_delete_self': return t('cannotDeleteSelf');
    case 'cannot_delete_last_admin': return t('cannotDeleteLast');
    case 'too_many_attempts': {
      const minutes = Math.max(1, Math.ceil((err.body.retryAfterSeconds || 60) / 60));
      return t(opts.throttleKey || 'loginThrottled').replace('{min}', minutes);
    }
    default: return t('saveError');
  }
}
