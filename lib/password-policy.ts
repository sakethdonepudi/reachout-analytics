/**
 * Password policy shared by setup, user creation, first-login change and
 * password reset.
 *
 * The common-password set below is the highest-frequency subset of the public
 * 10k list plus the shape rules that catch its variants. Passwords are compared
 * lower-cased, so capitalisation cannot bypass it.
 */

const COMMON = new Set(`
123456 123456789 12345678 12345 1234567 1234567890 1234 qwerty password password1 password12 password123
111111 123123 abc123 12345678910 12345678a qwerty123 1q2w3e4r 1qaz2wsx 123qwe zxcvbnm asdfgh
iloveyou admin admin123 welcome welcome1 monkey dragon sunshine princess football baseball
letmein master shadow superman batman trustno1 passw0rd p@ssw0rd pass1234 secret secret123
hello123 freedom whatever qazwsx qwertyuiop 1q2w3e 987654321 654321 666666 888888 777777
121212 112233 131313 159753 159357 123321 321321 147258369 741852963 789456123 qwe123
asd123 asdf1234 asdfghjkl zxcvbnm1 poiuytrewq mnbvcxz 1q2w3e4r5t 1qazxsw2 qwerty12 qwerty1234
password1234 password12345 password123456 adminadmin administrator root toor guest changeme
default pass pass123 letmein123 login welcome123 company company123 office office123
india india123 bharat bharat123 chennai tamilnadu telangana hyderabad delhi mumbai
election election123 campaign campaign123 politics politics123 reachout reachout123
january february march april may june july august september october november december
monday tuesday wednesday thursday friday saturday sunday summer winter spring autumn
football1 cricket cricket123 hockey tennis soccer basketball baseball1
michael jennifer jessica charlie thomas daniel matthew andrew joshua amanda ashley
nicole hannah samantha elizabeth victoria jordan hunter austin taylor morgan
robert william richard joseph christopher anthony donald steven paul mark
letmein1 master1 shadow1 sunshine1 princess1 welcome12 welcome1234
qwertyui 1password password! password@ password# password$ password% Password1 Password123
p@ssword p@ssw0rd1 passw0rd1 pass12345 secret12 secret1234 admin12 admin1234
`.trim().split(/\s+/).filter(Boolean));

const SHAPE_RULES: RegExp[] = [
  /^(.)\1{7,}$/,
  /^(0123|1234|2345|3456|4567|5678|6789|7890|9876|8765|7654|6543|5432|4321|3210){2,}$/,
  /^(qwerty|asdf|zxcv|qazwsx|poiuyt)+/,
  /^(password|admin|welcome|letmein|secret|iloveyou)[\d!@#$%^&*._-]*$/,
];

export type PasswordCheck = { ok: boolean; error?: string };

export function checkPassword(password: string, username: string): PasswordCheck {
  const value = String(password ?? "");
  if (value.length < 12) return { ok: false, error: "Use at least 12 characters." };
  if (value.length > 256) return { ok: false, error: "Use 256 characters or fewer." };
  const lower = value.toLowerCase();
  const user = String(username ?? "").toLowerCase();
  if (user.length >= 3 && lower.includes(user)) return { ok: false, error: "The password cannot contain the username." };
  if (COMMON.has(lower)) return { ok: false, error: "This password is too common. Choose another." };
  if (SHAPE_RULES.some((rule) => rule.test(lower))) return { ok: false, error: "This password is too predictable. Choose another." };
  return { ok: true };
}

export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  const value = String(password ?? "");
  if (!value) return 0;
  let score = 0;
  if (value.length >= 12) score += 1;
  if (value.length >= 16) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
}
