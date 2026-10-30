Pod::Spec.new do |s|
  s.name           = 'PetCutout'
  s.version        = '1.0.0'
  s.summary        = 'On-device pet cut-out with Vision'
  s.description    = 'Removes the background behind animals and people using VNGenerateForegroundInstanceMaskRequest (iOS 17+).'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Vision', 'CoreImage'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
