const path = require('path')

module.exports = {
  siteMetadata: {
    title: 'OI Wiki',
    description: 'Guide for OI',
    author: 'OI Wiki Team',
    siteUrl: 'https://ng.oi-wiki.org',
  },
  plugins: [
    'gatsby-source-local-git',
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        name: './docs/',
        path: './docs/',
      },
    },
    // 以 CI BUILD 开头的注释会在构建时被取消注释。
    // CI BUILD 'gatsby-plugin-sharp',
    // CI BUILD 'gatsby-transformer-sharp',
    {
      resolve: 'gatsby-plugin-mdx',
      options: {
        gatsbyRemarkPlugins: [
          // CI BUILD {
          // CI BUILD   resolve: 'gatsby-remark-images',
          // CI BUILD   options: {
          // CI BUILD     maxWidth: 900,
          // CI BUILD     withWebp: true,
          // CI BUILD     tracedSVG: false,
          // CI BUILD     linkImagesToOriginal: false,
          // CI BUILD     disableBgImageOnAlpha: true,
          // CI BUILD   },
          // CI BUILD },
          {
            resolve: 'gatsby-remark-copy-linked-files',
            options: {
              // By default, `.md` is specified
              // ignoreFileExtensions: ['.md']
              // These files will not be copied
              ignoreFileExtensions: ['.md'],
            },
          },
          /** {
            resolve: `gatsby-remark-autolink-headers`,
            options: {
              isIconAfterHeader: true,
            },
          }, */
          {
            resolve: 'gatsby-local-autolink-headers',
            options: {
              isIconAfterHeader: true,
            },
          },
          {
            resolve: 'gatsby-remark-vscode',
            options: {
              theme: 'Dark+ (default dark)', // Read on for list of included themes. Also accepts object and function forms.
              wrapperClassName: '', // Additional class put on 'pre' tag. Also accepts function to set the class dynamically.
              injectStyles: true, // Injects (minimal) additional CSS for layout and scrolling
              extensions: [], // Extensions to download from the marketplace to provide more languages and themes
              // Absolute path to the directory where extensions will be downloaded. Defaults to inside node_modules.
              extensionDataDirectory: path.resolve('extensions'),
              languageAliases: {}, // Map of custom/unknown language codes to standard/known language codes
              replaceColor: (x) => x, // Function allowing replacement of a theme color with another. Useful for replacing hex colors with CSS variables.
              getLineClassName: ({
                // Function allowing dynamic setting of additional class names on individual lines
                content, //   - the string content of the line
                index, //   - the zero-based index of the line within the code fence
                language, //   - the language specified for the code fence
                meta, //   - any options set on the code fence alongside the language (more on this later)
              }) => '',
              logLevel: 'warn', // Set to 'info' to debug if something looks wrong
            },
          },
        ],
        remarkPlugins: [require('remark-math'), require('remark-details')],
        rehypePlugins: [
          process.env.gatsby_executing_command === 'build'
            ? [require('rehype-mathjax/chtml'),
              { fontURL: 'https://cdn.jsdelivr.net/npm/mathjax@3.0.5/es5/output/chtml/fonts/woff-v2' }]
            : require('rehype-mathjax/browser'),
          require('rehype-details')],
        extensions: ['.mdx', '.md'],
      },
    },
    {
      resolve: 'gatsby-plugin-material-ui',
      options: {
        stylesProvider: {
          injectFirst: true,
        },
      },
    },
    'gatsby-plugin-catch-links',
    'gatsby-plugin-react-helmet',
    // CI BUILD {
    // CI BUILD   resolve: 'gatsby-plugin-manifest',
    // CI BUILD   options: {
    // CI BUILD     name: 'OI Wiki',
    // CI BUILD     short_name: 'OI Wiki',
    // CI BUILD     start_url: '/',
    // CI BUILD     display: 'standalone',
    // CI BUILD     icon: 'icon/favicon_512x512.png',
    // CI BUILD   },
    // CI BUILD },
    {
      resolve: 'gatsby-plugin-offline',
      options: {
        precachePages: [],
        workboxConfig: {
          importWorkboxFrom: 'local',
          globPatterns: ['page-data/**', '*.js'],
          runtimeCaching: [
            {
              urlPattern: /(\.js$|\.css$)/, // js and css
              handler: 'CacheFirst',
            },
            {
              urlPattern: /^https?:.*\.(json)$/, // page-data
              handler: 'NetworkFirst',
            },
            {
              urlPattern: /^https?:.*\.(woff|woff2)$/, // mathjax fonts
              handler: 'StaleWhileRevalidate',
            },
            {
              urlPattern: /^https?:.*\.(png|jpg|jpeg|webp|svg|gif|tiff)$/, // do not cache images
              handler: 'NetworkOnly',
            },
          ],
          skipWaiting: true,
          clientsClaim: true,
        },
      },
    },
    {
      resolve: 'gatsby-plugin-advanced-sitemap',
      options: {
        // 1 query for each data type
        query: `
        {
          allMdx {
            edges {
              node {
                id
                fields{
                  slug
                }
              }
            }
          }
        }`,
        mapping: {
          // Each data type can be mapped to a predefined sitemap
          // Routes can be grouped in one of: posts, tags, authors, pages, or a custom name
          // The default sitemap - if none is passed - will be pages
          allMdx: {
            sitemap: 'documents',
          },
        },
        exclude: [
          '/dev-404-page/',
          '/404.tsx/',
          '/404.html',
          '/offline-plugin-app-shell-fallback/',
          //          `/(\/)?hash-\S*/`, // you can also pass valid RegExp to exclude internal tags for example
        ],
        createLinkInHead: true, // optional: create a link in the `<head>` of your site
        addUncaughtPages: true, // optional: will fill up pages that are not caught by queries and mapping and list them under `sitemap-pages.xml`
      },
    },
    'gatsby-plugin-preact',
    // "gatsby-plugin-webpack-bundle-analyser-v2",
    // when you need to analyze bundle size, enable it
  ],
}
