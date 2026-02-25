module.exports = {
  apps: [
    {
      name: "discord-bot-prod",
      script: "dist/index.js",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "discord-bot-staging",
      script: "dist/index.js",
      cwd: __dirname,
      env: {
        NODE_ENV: "staging",
      },
    },
  ],
};
