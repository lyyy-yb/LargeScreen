import { defineConfig, presetAttributify, presetWind3, transformerDirectives, transformerVariantGroup } from 'unocss'

export default defineConfig({
  presets: [
    presetAttributify(),
    presetWind3(),
  ],
  shortcuts: {
    'itemCenter': 'absolute left-50% top-50% transform -translate-x-50% -translate-y-50%',
    'panel-bg': 'bg-[rgba(0,56,129,0.6)] backdrop-blur-md border border-[#50739A] rounded-lg',
    'tech-text': 'text-[#A8D6FF]',
    'tech-text-bright': 'text-[#03FBFD]',
    'tech-border': 'border-[#50739A]',
  },
  transformers: [transformerDirectives(), transformerVariantGroup()],
})
