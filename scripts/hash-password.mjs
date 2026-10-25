// Calcule l'empreinte du mot de passe admin, à poser ensuite dans D1 :
//   node scripts/hash-password.mjs
//   npx wrangler d1 execute index-db --remote --command "INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_password', '<empreinte>'); DELETE FROM sessions;"
// La saisie n'est pas affichée et le mot de passe ne quitte pas ce terminal.

import { hashPassword } from '../lib/password.js'

const MIN_PASSWORD = 10
const CTRL_C = String.fromCharCode(3)
const BACKSPACE = String.fromCharCode(8)
const DEL = String.fromCharCode(127)

function askHidden(question) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process
    if (!stdin.isTTY) { reject(new Error('Lancer ce script dans un vrai terminal.')); return }
    stdout.write(question)
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    let value = ''
    const onData = chunk => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false); stdin.pause(); stdin.off('data', onData)
          stdout.write('\n'); resolve(value); return
        }
        if (ch === CTRL_C) { stdout.write('\n'); process.exit(130) }
        if (ch === DEL || ch === BACKSPACE) value = value.slice(0, -1)
        else value += ch
      }
    }
    stdin.on('data', onData)
  })
}

const first = await askHidden('Nouveau mot de passe : ')
if (first.length < MIN_PASSWORD) {
  console.error(`Trop court : ${MIN_PASSWORD} caractères au moins.`)
  process.exit(1)
}
const second = await askHidden('Confirmer : ')
if (first !== second) {
  console.error('Les deux saisies diffèrent.')
  process.exit(1)
}
console.log(await hashPassword(first))
