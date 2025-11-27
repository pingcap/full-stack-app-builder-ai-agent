import { hash } from "bcrypt";
import readline from "readline/promises";

const rl = new readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const password = await rl.question("new password> ");

const res = await hash(password, process.env.BCRYPT_SALT);

console.log(res);

rl.close();
