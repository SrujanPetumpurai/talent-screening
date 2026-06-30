import "dotenv/config";

const ANSWER_ID = "cmr0l8jhg0000k8ug6n0bqctu";

async function main() {
  const fakeChunk = Buffer.from("fake video bytes for testing");

  const res = await fetch(
    `http://localhost:3000/api/answers/${ANSWER_ID}/chunk?chunkIndex=0`,
    {
      method: "POST",
      body: fakeChunk,
    }
  );

  const data = await res.json();
  console.log("Status:", res.status);
  console.log("Response:", data);
}

main().catch(console.error);