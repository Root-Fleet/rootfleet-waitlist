export const onRequestGet = ({ env }) => {
  return new Response(
    JSON.stringify({
      env: env.ENVIRONMENT ?? "unknown",
      d1: env.DB ? "bound" : "missing",
    }),
    {
      headers: { "content-type": "application/json" },
    }
  );
};
