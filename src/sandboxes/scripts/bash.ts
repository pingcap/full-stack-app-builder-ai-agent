export async function bash(temp: TemplateStringsArray, ...args: any[]) {
  return "";
}

bash`
set -e ${123}
`;
