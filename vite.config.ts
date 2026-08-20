import { defineConfig, PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import unocss from 'unocss/vite'
import legacy from '@vitejs/plugin-legacy'
import viteCompression from 'vite-plugin-compression'

export default defineConfig(({ mode }) => {
  const vitePlugins: PluginOption[] = [
    react(),
    unocss(),
  ]

  if (mode === 'production') {
    vitePlugins.push(
      legacy({
        targets: [
          'Chrome >= 88',
          'Firefox >= 74',
        ],
        additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      }),
      viteCompression()
    )
  }

  return {
    plugins: vitePlugins,
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    css: {
      preprocessorOptions: {
        less: {
          javascriptEnabled: true,
          charset: false,
        },
      },
    },
    server: {
      open: true,
      port: 5556,
      proxy: {
        '^/offMap': {
          target: 'http://218.244.154.247:5555/offMap',
          changeOrigin: true,
          rewrite: (path) => path.replace(new RegExp('^/offMap/'), '/'),
        },
        '^/dpSys': {
          target: 'http://218.244.154.247:8089',
          changeOrigin: true,
          rewrite: (path) => path.replace(new RegExp('^/dpSys/'), '/'),
        },
        '^/upImg': {
          target: 'http://218.244.154.247:5555/upImg',
          changeOrigin: true,
          rewrite: (path) => path.replace(new RegExp('^/upImg/'), '/'),
        },
        '^/prod-api': {
          target: 'http://218.244.154.247:7089',
          changeOrigin: true,
        },
        '^/profile': {
          target: 'http://218.244.154.247:7089/prod-api',
          changeOrigin: true,
        },
        '^/gaodeservice': {
          target: 'https://gaode.com/service',
          changeOrigin: true,
          rewrite: (path) => path.replace(new RegExp('^/gaodeservice/'), '/'),
        },
      },
    },
    sourcemap: mode !== 'production',
    build: {
      minify: 'terser',
      terserOptions: {
        compress: {
          // 仅剔除调试日志，保留 console.error/warn 供生产排障（错误边界/地图加载失败诊断）
          pure_funcs: ['console.log', 'console.debug', 'console.info'],
          drop_debugger: true,
        },
      },
      rollupOptions: {
        output: {
          chunkFileNames: 'assets/js/[name].[hash].js',
          entryFileNames: 'assets/js/[name].[hash].js',
          assetFileNames: 'assets/[ext]/[name].[hash].[ext]',
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
                return 'react-vendor'
              }
              if (id.includes('antd') || id.includes('@ant-design')) {
                return 'antd-vendor'
              }
              if (id.includes('@antv')) {
                // G2 仅 monitor 弹窗用，与 L7 地图引擎分 chunk，避免单包过大
                if (id.includes('@antv/g2') || id.includes('node_modules/@antv/scale') || id.includes('@antv/coord')) {
                  return 'antv-g2'
                }
                return 'antv-l7'
              }
              return 'vendor'
            }
          },
        },
      },
    },
  }
})
