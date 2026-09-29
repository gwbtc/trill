::  lib/nip44.hoon against the NIP-44 v2 test vectors
::  (github.com/paulmillr/nip44, nip44.vectors.json in bulk/specs/)
::
/+  nip44
=>
|%
++  num  |=(h=@t (rash h hex))
++  check
  |=  [what=@t ok=?]
  ^-  tang
  ?:(ok ~ ~[leaf+(trip what)])
--
|%
++  test-conversation-key
  ^-  tang
  %-  zing
  ^-  (list tang)
  %+  turn
    ^-  (list [@t @t @t])
    :~
      ['315e59ff51cb9209768cf7da80791ddcaae56ac9775eb25b6dee1234bc5d2268' 'c2f9d9948dc8c7c38321e4b85c8558872eafa0641cd269db76848a6073e69133' '3dfef0ce2a4d80a25e7a328accf73448ef67096f65f79588e358d9a0eb9013f1']
      ['a1e37752c9fdc1273be53f68c5f74be7c8905728e8de75800b94262f9497c86e' '03bb7947065dde12ba991ea045132581d0954f042c84e06d8c00066e23c1a800' '4d14f36e81b8452128da64fe6f1eae873baae2f444b02c950b90e43553f2178b']
      ['98a5902fd67518a0c900f0fb62158f278f94a21d6f9d33d30cd3091195500311' 'aae65c15f98e5e677b5050de82e3aba47a6fe49b3dab7863cf35d9478ba9f7d1' '9c00b769d5f54d02bf175b7284a1cbd28b6911b06cda6666b2243561ac96bad7']
      ['86ae5ac8034eb2542ce23ec2f84375655dab7f836836bbd3c54cefe9fdc9c19f' '59f90272378089d73f1339710c02e2be6db584e9cdbe86eed3578f0c67c23585' '19f934aafd3324e8415299b64df42049afaa051c71c98d0aa10e1081f2e3e2ba']
      ['2528c287fe822421bc0dc4c3615878eb98e8a8c31657616d08b29c00ce209e34' 'f66ea16104c01a1c532e03f166c5370a22a5505753005a566366097150c6df60' 'c833bbb292956c43366145326d53b955ffb5da4e4998a2d853611841903f5442']
      ['49808637b2d21129478041813aceb6f2c9d4929cd1303cdaf4fbdbd690905ff2' '74d2aab13e97827ea21baf253ad7e39b974bb2498cc747cdb168582a11847b65' '4bf304d3c8c4608864c0fe03890b90279328cd24a018ffa9eb8f8ccec06b505d']
    ==
  |=  [sec=@t pub=@t key=@t]
  %+  check  (cat 3 'conversation key ' key)
  =((num key) (conversation-key:nip44 (num sec) (num pub)))
::
++  test-message-keys
  ^-  tang
  =/  key  (num 'a1a3d60f3470a8612633924e91febf96dc5366ce130f658b1f0fc652c20b3b54')
  %-  zing
  ^-  (list tang)
  %+  turn
    ^-  (list [@t @t @t @t])
    :~
      ['e1e6f880560d6d149ed83dcc7e5861ee62a5ee051f7fde9975fe5d25d2a02d72' 'f145f3bed47cb70dbeaac07f3a3fe683e822b3715edb7c4fe310829014ce7d76' 'c4ad129bb01180c0933a160c' '027c1db445f05e2eee864a0975b0ddef5b7110583c8c192de3732571ca5838c4']
      ['e1d6d28c46de60168b43d79dacc519698512ec35e8ccb12640fc8e9f26121101' 'e35b88f8d4a8f1606c5082f7a64b100e5d85fcdb2e62aeafbec03fb9e860ad92' '22925e920cee4a50a478be90' '46a7c55d4283cb0df1d5e29540be67abfe709e3b2e14b7bf9976e6df994ded30']
      ['cfc13bef512ac9c15951ab00030dfaf2626fdca638dedb35f2993a9eeb85d650' '020783eb35fdf5b80ef8c75377f4e937efb26bcbad0e61b4190e39939860c4bf' 'd3594987af769a52904656ac' '237ec0ccb6ebd53d179fa8fd319e092acff599ef174c1fdafd499ef2b8dee745']
    ==
  |=  [nonce=@t ck=@t cn=@t hk=@t]
  =/  [a=@ b=@ c=@]  (message-keys:nip44 key (num nonce))
  %+  check  (cat 3 'message keys ' nonce)
  ?&  =((num ck) (rev 3 32 a))
      =((num cn) (rev 3 12 b))
      =((num hk) (rev 3 32 c))
  ==
::
++  test-padded-len
  ^-  tang
  %-  zing
  ^-  (list tang)
  %+  turn
    ^-  (list [@ud @ud])
    :~  [16 32]  [32 32]  [33 64]  [37 64]  [45 64]  [49 64]  [64 64]  [65 96]  [100 128]  [111 128]  [200 224]  [250 256]  [320 320]  [383 384]  [384 384]  [400 448]  [500 512]  [512 512]  [515 640]  [700 768]  [800 896]  [900 1.024]  [1.020 1.024]  [65.536 65.536]  ==
  |=  [len=@ud padded=@ud]
  (check (crip "padded {<len>}") =(padded (padded-len:nip44 len)))
::  each: the payload is exactly the vector's, and decrypts back
::
++  test-encrypt-decrypt
  ^-  tang
  %-  zing
  ^-  (list tang)
  %+  turn
    ^-  (list [@t @t @t @t])
    :~
      :*  'c41c775356fd92eadc63ff5a0dc1da211b268cbea22316767095b2871ea1412d'
          '0000000000000000000000000000000000000000000000000000000000000001'
          'a'
          'AgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABee0G5VSK0/9YypIObAtDKfYEAjD35uVkHyB0F4DwrcNaCXlCWZKaArsGrY6M9wnuTMxWfp1RTN9Xga8no+kF5Vsb'
      ==
      :*  'c41c775356fd92eadc63ff5a0dc1da211b268cbea22316767095b2871ea1412d'
          'f00000000000000000000000000000f00000000000000000000000000000000f'
          '🍕🫃'
          'AvAAAAAAAAAAAAAAAAAAAPAAAAAAAAAAAAAAAAAAAAAPSKSK6is9ngkX2+cSq85Th16oRTISAOfhStnixqZziKMDvB0QQzgFZdjLTPicCJaV8nDITO+QfaQ61+KbWQIOO2Yj'
      ==
      :*  '3e2b52a63be47d34fe0a80e34e73d436d6963bc8f39827f327057a9986c20a45'
          'b635236c42db20f021bb8d1cdff5ca75dd1a0cc72ea742ad750f33010b24f73b'
          '表ポあA鷗ŒéＢ逍Üßªąñ丂㐀𠀀'
          'ArY1I2xC2yDwIbuNHN/1ynXdGgzHLqdCrXUPMwELJPc7s7JqlCMJBAIIjfkpHReBPXeoMCyuClwgbT419jUWU1PwaNl4FEQYKCDKVJz+97Mp3K+Q2YGa77B6gpxB/lr1QgoqpDf7wDVrDmOqGoiPjWDqy8KzLueKDcm9BVP8xeTJIxs='
      ==
      :*  'd5a2f879123145a4b291d767428870f5a8d9e5007193321795b40183d4ab8c2b'
          'b20989adc3ddc41cd2c435952c0d59a91315d8c5218d5040573fc3749543acaf'
          'ability🤝的 ȺȾ'
          'ArIJia3D3cQc0sQ1lSwNWakTFdjFIY1QQFc/w3SVQ6yvbG2S0x4Yu86QGwPTy7mP3961I1XqB6SFFTzqDZZavhxoWMj7mEVGMQIsh2RLWI5EYQaQDIePSnXPlzf7CIt+voTD'
      ==
      :*  '3b15c977e20bfe4b8482991274635edd94f366595b1a3d2993515705ca3cedb8'
          '8d4442713eb9d4791175cb040d98d6fc5be8864d6ec2f89cf0895a2b2b72d1b1'
          'pepper👀їжак'
          'Ao1EQnE+udR5EXXLBA2Y1vxb6IZNbsL4nPCJWisrctGxY3AduCS+jTUgAAnfvKafkmpy15+i9YMwCdccisRa8SvzW671T2JO4LFSPX31K4kYUKelSAdSPwe9NwO6LhOsnoJ+'
      ==
      :*  '4f1538411098cf11c8af216836444787c462d47f97287f46cf7edb2c4915b8a5'
          '2180b52ae645fcf9f5080d81b1f0b5d6f2cd77ff3c986882bb549158462f3407'
          '( ͡° ͜ʖ ͡°)'
          'AiGAtSrmRfz59QgNgbHwtdbyzXf/PJhogrtUkVhGLzQHv4qhKQwnFQ54OjVMgqCea/Vj0YqBSdhqNR777TJ4zIUk7R0fnizp6l1zwgzWv7+ee6u+0/89KIjY5q1wu6inyuiv'
      ==
      :*  '75fe686d21a035f0c7cd70da64ba307936e5ca0b20710496a6b6b5f573377bdd'
          'e4cd5f7ce4eea024bc71b17ad456a986a74ac426c2c62b0a15eb5c5c8f888b68'
          'مُنَاقَشَةُ سُبُلِ اِسْتِخْدَامِ اللُّغَةِ فِي النُّظُمِ الْقَائِمَةِ وَفِيم يَخُصَّ التَّطْبِيقَاتُ الْحاسُوبِيَّةُ،'
          'AuTNX3zk7qAkvHGxetRWqYanSsQmwsYrChXrXFyPiItoIBsWu1CB+sStla2M4VeANASHxM78i1CfHQQH1YbBy24Tng7emYW44ol6QkFD6D8Zq7QPl+8L1c47lx8RoODEQMvNCbOk5ffUV3/AhONHBXnffrI+0025c+uRGzfqpYki4lBqm9iYU+k3Tvjczq9wU0mkVDEaM34WiQi30MfkJdRbeeYaq6kNvGPunLb3xdjjs5DL720d61Flc5ZfoZm+CBhADy9D9XiVZYLKAlkijALJur9dATYKci6OBOoc2SJS2Clai5hOVzR0yVeyHRgRfH9aLSlWW5dXcUxTo7qqRjNf8W5+J4jF4gNQp5f5d0YA4vPAzjBwSP/5bGzNDslKfcAH'
      ==
      :*  '75fe686d21a035f0c7cd70da64ba307936e5ca0b20710496a6b6b5f573377bdd'
          '38d1ca0abef9e5f564e89761a86cee04574b6825d3ef2063b10ad75899e4b023'
          'الكل في المجمو عة (5)'
          'AjjRygq++eX1ZOiXYahs7gRXS2gl0+8gY7EK11iZ5LAjbOTrlfrxak5Lki42v2jMPpLSicy8eHjsWkkMtF0i925vOaKG/ZkMHh9ccQBdfTvgEGKzztedqDCAWb5TP1YwU1PsWaiiqG3+WgVvJiO4lUdMHXL7+zKKx8bgDtowzz4QAwI='
      ==
      :*  '75fe686d21a035f0c7cd70da64ba307936e5ca0b20710496a6b6b5f573377bdd'
          '4f1a31909f3483a9e69c8549a55bbc9af25fa5bbecf7bd32d9896f83ef2e12e0'
          '𝖑𝖆𝖟𝖞 社會科學院語學研究所'
          'Ak8aMZCfNIOp5pyFSaVbvJryX6W77Pe9MtmJb4PvLhLgh/TsxPLFSANcT67EC1t/qxjru5ZoADjKVEt2ejdx+xGvH49mcdfbc+l+L7gJtkH7GLKpE9pQNQWNHMAmj043PAXJZ++fiJObMRR2mye5VHEANzZWkZXMrXF7YjuG10S1pOU='
      ==
      :*  '75fe686d21a035f0c7cd70da64ba307936e5ca0b20710496a6b6b5f573377bdd'
          'a3e219242d85465e70adcd640b564b3feff57d2ef8745d5e7a0663b2dccceb54'
          '🙈 🙉 🙊 0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟 Powerلُلُصّبُلُلصّبُررً ॣ ॣh ॣ ॣ冗'
          'AqPiGSQthUZecK3NZAtWSz/v9X0u+HRdXnoGY7LczOtUf05aMF89q1FLwJvaFJYICZoMYgRJHFLwPiOHce7fuAc40kX0wXJvipyBJ9HzCOj7CgtnC1/cmPCHR3s5AIORmroBWglm1LiFMohv1FSPEbaBD51VXxJa4JyWpYhreSOEjn1wd0lMKC9b+osV2N2tpbs+rbpQem2tRen3sWflmCqjkG5VOVwRErCuXuPb5+hYwd8BoZbfCrsiAVLd7YT44dRtKNBx6rkabWfddKSLtreHLDysOhQUVOp/XkE7OzSkWl6sky0Hva6qJJ/V726hMlomvcLHjE41iKmW2CpcZfOedg=='
      ==
    ==
  |=  [key=@t nonce=@t text=@t payload=@t]
  =/  made  (encrypt:nip44 (num key) (num nonce) text)
  ;:  weld
    (check (cat 3 'encrypt ' nonce) =(payload made))
    (check (cat 3 'decrypt ' nonce) =(`text (decrypt:nip44 (num key) payload)))
    ::  a flipped mac byte is refused
    %+  check  (cat 3 'bad mac ' nonce)
    =/  raw  (need (de:base64:mimes:html payload))
    =/  bad  (en:base64:mimes:html raw(q (mix q.raw (lsh [3 (dec p.raw)] 1))))
    =(~ (decrypt:nip44 (num key) bad))
  ==
--
