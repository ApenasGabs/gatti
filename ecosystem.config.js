module.exports = {
  apps: [
    {
      name: "zapsons",
      script: "./zapsons.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      error_file: "./logs/zapsons-error.log",
      out_file: "./logs/zapsons-out.log",
      time: true,
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "gatti",
      script: "./gatti.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      error_file: "./logs/gatti-error.log",
      out_file: "./logs/gatti-out.log",
      time: true,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
