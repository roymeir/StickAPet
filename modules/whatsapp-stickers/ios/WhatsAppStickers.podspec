Pod::Spec.new do |s|
  s.name           = 'WhatsAppStickers'
  s.version        = '1.0.0'
  s.summary        = 'Send a sticker pack to WhatsApp'
  s.description    = 'Pasteboard + whatsapp://stickerPack handoff, as in the official WhatsApp iOS sample.'
  s.author         = ''
  s.homepage       = 'https://github.com/WhatsApp/stickers'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
