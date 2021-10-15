const { resolve } = require("path");

module.exports = (api) => {
  api.cache(true);

  return {
    presets: [
      [
      "@babel/preset-env", { targets: { node: "current" } }],
      "@babel/preset-typescript",
    ],
    plugins: [
      [
        "search-and-replace",
        {
          rules: [
            {
              search: "import_meta_url",
              replace: resolve(__dirname),
            },
          ],
        },
      ],
    ],
  };
};
