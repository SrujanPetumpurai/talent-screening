import "dotenv/config";
import { uploadToR2 } from "../lib/r2";

async function main() {
  const url = await uploadToR2(
    "test/hello.txt",
    Buffer.from("hello from talent-screening"),
    "text/plain"
  );
  console.log("Uploaded. Public URL:", url);
}

main().catch(console.error);