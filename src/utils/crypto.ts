import CryptoJS from 'crypto-js'

const SECRET_KEY = CryptoJS.enc.Utf8.parse('LargeScreen2024!')
const IV = CryptoJS.enc.Utf8.parse('1234567890123456')

export function encrypt(text: string): string {
  const encrypted = CryptoJS.AES.encrypt(text, SECRET_KEY, {
    iv: IV,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  })
  return encrypted.toString()
}

export function decrypt(ciphertext: string): string {
  const decrypted = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY, {
    iv: IV,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  })
  return decrypted.toString(CryptoJS.enc.Utf8)
}
