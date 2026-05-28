import path from "path";
import { fileURLToPath } from "url";

export default function getRelativeFilePath(url, relativeUrl) {
  const __filename = fileURLToPath(url);
  return path.resolve(path.dirname(__filename), relativeUrl);
}
