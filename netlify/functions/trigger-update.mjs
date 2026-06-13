const OWNER = "johnkennedy9147";
const REPO = "WC-Sweep";
const WORKFLOW = "update-data.yml";

export default async () => {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GH_DISPATCH_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "wc-sweep-scheduler",
      },
      body: JSON.stringify({ ref: "main" }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    console.error(`dispatch failed: ${res.status} ${body}`);
    return new Response(`dispatch failed: ${res.status}`, { status: 500 });
  }
  return new Response("dispatched"); 
};

export const config = { schedule: "7,17,27,37,47,57 0-6,15-23 * * *" };
