const postcss = require("postcss");

module.exports = {
  style: {
    postcss: {
      plugins: [require("tailwindcss"), require("autoprefixer")],
    },
  },
  webpack: {
    configure: (webpackConfig) => {
      // Ensure Webpack dev server uses modern setup
      if (webpackConfig.devServer) {
        webpackConfig.devServer.onBeforeSetupMiddleware = undefined;
        webpackConfig.devServer.onAfterSetupMiddleware = undefined;
      }
      return webpackConfig;
    },
  },
  devServer: {
    setupMiddlewares: (middlewares, devServer) => {
      if (!devServer) {
        throw new Error("Webpack dev server is not defined");
      }
      return middlewares;
    },
  },
};
