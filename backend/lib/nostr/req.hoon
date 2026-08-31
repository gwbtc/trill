/-  sur=nostr
/+  js=json-nostr, sr=sortug,
    server,
    ws=websockets,
    bip=bip-bip
|%
++  parse-client-msg
  |=  jon=json  ^-  (unit client-msg:sur)
  (client-msg:de:js jon)
++  ok-client-event  |=  [=event:sur ok=? msg=@t]
  ^-  relay-msg:sur
  [%ok id.event ok msg]
++  ws-response
  |=  [wid=@ msg=relay-msg:sur]  ^-  (list card:agent:gall)
  =/  jon    (relay-msg:en:js msg)
  =/  octs   (json-to-octs:server jon)
  =/  res-event=websocket-event:eyre  [%message 1 `octs]
  :~
    (give-ws-payload-server:ws wid res-event)
  ==
::  filter inspection: classify what a subscription was asking for
::
++  is-feed  |=  fs=(list filter:sur)  ^-  ?
  |-  ?~  fs  .n
    =/  filter  i.fs
    ?~  kinds.filter  .n
      ?:  (~(has in u.kinds.filter) 0)  .n
        ?:  ?&  (~(has in u.kinds.filter) 1)
                ?=(%~ ids.filter)
                ?=(%~ authors.filter)
                ?=(%~ tags.filter)
            ==  .y
    $(fs t.fs)
::
++  profs-req  |=  fs=(list filter:sur)  ^-  ?
  |-  ?~  fs  .n
    =/  filter  i.fs
    ?~  kinds.filter    .n
    ?:  (~(has in u.kinds.filter) 0)  .y
    $(fs t.fs)
::
++  user-req  |=  fs=(list filter:sur)  ^-  (set @ux)
  =|  pubkeys=(set @ux)
  |-  ?~  fs  pubkeys
    =/  filter  i.fs
    ?~  kinds.filter    ~
    ?~  authors.filter  ~
    =?  pubkeys
      ?&  (~(has in u.kinds.filter) 1)
          ?=(%~ ids.filter)
      ==  (~(uni in pubkeys) u.authors.filter)
    $(fs t.fs)
::
++  thread-req  |=  fs=(list filter:sur)  ^-  (unit @ux)
  =|  parent=(unit @ux)
  |-  ?~  fs  ~
    =/  filter  i.fs
    ?~  parent
      =/  upid  (post-filter filter)
      $(fs t.fs, parent upid)
    =/  replies-parent  (replies-filter i.fs)
    ?:  ?&  ?=(^ replies-parent)
            .=(u.replies-parent u.parent)
        ==  parent
    $(fs t.fs)
::
++  post-filter  |=  =filter:sur  ^-  (unit @ux)
  ?~  kinds.filter  ~
  ?~  ids.filter    ~
  =/  post-filter  (silt ~[1])
  ?.  .=(u.kinds.filter post-filter)  ~
  =/  idl  ~(tap in u.ids.filter)
  ?~  idl  ~
  ?.  .=(1 (lent idl))  ~
  `i.idl
::
++  replies-filter  |=  =filter:sur  ^-  (unit @ux)
  ?~  kinds.filter  ~
  ?~  tags.filter   ~
  =/  post-filter  (silt ~[1])
  ?.  .=(u.kinds.filter post-filter)  ~
  =/  tag  (~(get by u.tags.filter) 'e')
  ?~  tag    ~
  ?~  u.tag  ~
  (slaw:sr %ux i.u.tag)
::
++  default-follows
  =/  npubs
  :~
  "npub12rv5lskctqxxs2c8rf2zlzc7xx3qpvzs3w4etgemauy9thegr43sf485vg"
  "npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft"
  "npub1c878wu04lfqcl5avfy3p5x83ndpvedaxv0dg7pxthakq3jqdyzcs2n8avm"
  "npub107jk7htfv243u0x5ynn43scq9wrxtaasmrwwa8lfu2ydwag6cx2quqncxg"
  "npub1qkfnmpuz692azr8c5phn0930x2v92xyqvwgr6ve8znaa3qd6c3hq09ertp"
  "npub1u8lnhlw5usp3t9vmpz60ejpyt649z33hu82wc2hpv6m5xdqmuxhs46turz"
  "npub1zuuajd7u3sx8xu92yav9jwxpr839cs0kc3q6t56vd5u9q033xmhsk6c2uc"
  "npub1xdtducdnjerex88gkg2qk2atsdlqsyxqaag4h05jmcpyspqt30wscmntxy"
  "npub1jlrs53pkdfjnts29kveljul2sm0actt6n8dxrrzqcersttvcuv3qdjynqn"
  "npub1xv8mzscll8vvy5rsdw7dcqtd2j268a6yupr6gzqh86f2ulhy9kkqmclk3x"
  "npub16c0nh3dnadzqpm76uctf5hqhe2lny344zsmpm6feee9p5rdxaa9q586nvr"
  "npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6"
  "npub1acg6thl5psv62405rljzkj8spesceyfz2c32udakc2ak0dmvfeyse9p35c"
  "npub1dergggklka99wwrs92yz8wdjs952h2ux2ha2ed598ngwu9w7a6fsh9xzpc"
  "npub10000003zmk89narqpczy4ff6rnuht2wu05na7kpnh3mak7z2tqzsv8vwqk"
  "npub1z7eqn5603ltuxr77w70t3sasep8hyngzr6lxqpa9hfcqjwe9wmdqhw0qhv"
  "npub15879mltlln6k8jy32k6xvagmtqx3zhsndchcey8gjyectwldk88sq5kv0n"
  "npub1xtscya34g58tk0z605fvr788k263gsu6cy9x0mhnm87echrgufzsevkk5s"
  "npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m"
  "npub1nmq83muu5v0phkaew96amcwtqzle7u39ummz9nxg6dnnqt3zqjtse7vt4s"
  "npub1t8lmu87g980vlyr92sut6t0n57m5dm62q3356nhfu2qtkm89798qqwsf7p"
  "npub1renaud65zug8r570ndztde2xhk206z3v50a5mwa3kp2xshy3zmjqkqaw97"
  "npub13qrrw2h4z52m7jh0spefrwtysl4psfkfv6j4j672se5hkhvtyw7qu0almy"
  "npub166hl5x2mkuv55uzcxt6nt7n9h2ca3hx6mf4j2s8lxjehpygsk9msxj0thf"
  "npub1htg06l09dcjqqfhl55hhtnzp3yd4klv7dm8w64egygmcr7pswz2sr32fuc"
  "npub1tlgqfynfdyup4s4m8ge8yqpkm8ukxtfflv3dcxl4mra3e83x27vqrlj5tp"
  "npub1eulxt0p36rpn0gdsr99tn2pcvv8ne4prf0qz3k3s9pcn3qe0htqq36cndk"
  "npub1xtscya34g58tk0z605fvr788k263gsu6cy9x0mhnm87echrgufzsevkk5s"
  "npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m"
  "npub1j8y6tcdfw3q3f3h794s6un0gyc5742s0k5h5s2yqj0r70cpklqeqjavrvg"
  "npub1csamkk8zu67zl9z4wkp90a462v53q775aqn5q6xzjdkxnkvcpd7srtz4x9"
  "npub1qqqqqqyz0la2jjl752yv8h7wgs3v098mh9nztd4nr6gynaef6uqqt0n47m"
  "npub1qny3tkh0acurzla8x3zy4nhrjz5zd8l9sy9jys09umwng00manysew95gx"
  "npub1dergggklka99wwrs92yz8wdjs952h2ux2ha2ed598ngwu9w7a6fsh9xzpc"
  "npub1y24gz5gwucl79vtv4ctwpysl0r5m4xyzu2rgulnr44ks3t5mt92q4nz2ad"
  "npub1z4m7gkva6yxgvdyclc7zp0vz4ta0s2d9jh8g83w03tp5vdf3kzdsxana6p"
  "npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6"
  "npub18ams6ewn5aj2n3wt2qawzglx9mr4nzksxhvrdc4gzrecw7n5tvjqctp424"
  "npub107jk7htfv243u0x5ynn43scq9wrxtaasmrwwa8lfu2ydwag6cx2quqncxg"
  "npub1sn0wdenkukak0d9dfczzeacvhkrgz92ak56egt7vdgzn8pv2wfqqhrjdv9"
  "npub1s5yq6wadwrxde4lhfs56gn64hwzuhnfa6r9mj476r5s4hkunzgzqrs6q7z"
  "npub1lrnvvs6z78s9yjqxxr38uyqkmn34lsaxznnqgd877j4z2qej3j5s09qnw5"
  "npub1tvqc82mv8cezhax5r34n4muc2c4pgjz8kaye2smj032nngg52clq0rkrq4"
  "npub1cj8znuztfqkvq89pl8hceph0svvvqk0qay6nydgk9uyq7fhpfsgsqwrz4u"
  "npub1hu3hdctm5nkzd8gslnyedfr5ddz3z547jqcl5j88g4fame2jd08qh6h8nh"
  "npub16vrkgd28wq6n0h77lqgu8h4fdu0eapxgyj0zqq6ngfvjf2vs3nuq5mp2va"
  "npub1a2cww4kn9wqte4ry70vyfwqyqvpswksna27rtxd8vty6c74era8sdcw83a"
  "npub1gcxzte5zlkncx26j68ez60fzkvtkm9e0vrwdcvsjakxf9mu9qewqlfnj5z"
  "npub1cjw49ftnxene9wdxujz3tp7zspp0kf862cjud4nm3j2usag6eg2smwj2rh"
  "npub1sqaxzwvh5fhgw9q3d7v658ucapvfeds3dcd2587fcwyesn7dnwuqt2r45v"
  "npub1jt0x3vsnqtazzda3ewa8ykdch2t8k566qhrd9vyy0k0ntleu744q8h6q3n"
  "npub1cn4t4cd78nm900qc2hhqte5aa8c9njm6qkfzw95tszufwcwtcnsq7g3vle"
  "npub17u5dneh8qjp43ecfxr6u5e9sjamsmxyuekrg2nlxrrk6nj9rsyrqywt4tp"
  "npub1cn4t4cd78nm900qc2hhqte5aa8c9njm6qkfzw95tszufwcwtcnsq7g3vle"
  "npub1hqaz3dlyuhfqhktqchawke39l92jj9nt30dsgh2zvd9z7dv3j3gqpkt56s"
  "npub1clk6vc9xhjp8q5cws262wuf2eh4zuvwupft03hy4ttqqnm7e0jrq3upup9"
  "npub1g53mukxnjkcmr94fhryzkqutdz2ukq4ks0gvy5af25rgmwsl4ngq43drvk"
  "npub12rv5lskctqxxs2c8rf2zlzc7xx3qpvzs3w4etgemauy9thegr43sf485vg"
  "npub1r0rs5q2gk0e3dk3nlc7gnu378ec6cnlenqp8a3cjhyzu6f8k5sgs4sq9ac"
  "npub1v6xwae25wh6etmqw3m6yce9lnk5dnhtqpzk9fhxjfvjsryctjc8q2kxk5t"
  "npub13pnmakf738yn6rv2ex9jgs7924renmderyp5d9rtztsr7ymxg3gqej06vw"
  "npub1rxysxnjkhrmqd3ey73dp9n5y5yvyzcs64acc9g0k2epcpwwyya4spvhnp8"
  "npub1pyp9fqq60689ppds9ec3vghsm7s6s4grfya0y342g2hs3a0y6t0segc0qq"
  "npub14xu4ykvj5jr2594nc8fln5mqf09q3u7ptdcj6ur3rwdwekxrm3zq86428l"
  "npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft"
  "npub1504jj42t6flu5l6n7e389e9mt8gxduhnzuyv7dq4gr95w20mmpqscx0cg0"
  "npub137c5pd8gmhhe0njtsgwjgunc5xjr2vmzvglkgqs5sjeh972gqqxqjak37w"
  "npub1du8vg3lqmfddfwdr52h08etty3speg45dttmyvup6x2pqq5jxf6qdhu524"
  "npub1fl7pr0azlpgk469u034lsgn46dvwguz9g339p03dpetp9cs5pq5qxzeknp"
  "npub1r0fj5wr200n0dz9nm37ysrhuy8xeg66ratq5hf960q62caaz8e5sqpuzz3"
  "npub1h8nk2346qezka5cpm8jjh3yl5j88pf4ly2ptu7s6uu55wcfqy0wq36rpev"
  "npub1nxy4qpqnld6kmpphjykvx2lqwvxmuxluddwjamm4nc29ds3elyzsm5avr7"
  "npub1rqe7upz9nl4jef9wdyx47vfxnt2g3357tl5s8fpt2vkxwlz2s9cq9w3jdt"
  "npub15wcvuhts6rdj9zzhq6etru2yc6ry5ljg9zk070u0q89xk065452sjvqy0q"
  "npub1ktt8phjnkfmfrsxrgqpztdjuxk3x6psf80xyray0l3c7pyrln49qhkyhz0"
  "npub1excellx58e497gan6fcsdnseujkjm7ym5yp3m4rp0ud4j8ss39js2pn72a"
  "npub1jk9h2jsa8hjmtm9qlcca942473gnyhuynz5rmgve0dlu6hpeazxqc3lqz7"
  "npub1ckp277xl73p8qrk9ncshsefj5ur5cq973da3atycnwlky6vqd8xq5r7tnx"
  "npub1rt65j4vnd05qf72szpj8afdd5hrkylka7pe55lup8waquv0wm9sqjj0y9g"
  "npub1yy3uc7y85faxy5cwq8f574yda3j9457p7r9h2ymlkwlx6lp8f4vsy4kawc"
  "npub1tq84zxhs57wjej3qlddldwuf40nf3pvnlptgza7j55f7s7ethmesnx9jwx"
  "npub18nagz6a53yh6d05e8trj487dhvyfhh4qchvsz87jqng4g4zl5tvs825evl"
  "npub1et2e4pewzp2l2uv6289ejg5r3cnukq2sgujq0z35fpahyf5e8gtsd98n82"
  ==
  %+  turn  npubs  npub-to-hex:bip
--
