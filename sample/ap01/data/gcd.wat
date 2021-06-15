(module
  (func (export "gcd") (param $small i32) (param $large i32) (result i32)
    (local $rem i32)
    (local $tmp i32)

    (if (i32.lt_s (local.get $large) (local.get $small)) 
      (then 
        ;; swap
        (local.set $tmp (local.get $large))
        (local.set $large (local.get $small))
        (local.set $small (local.get $tmp))
      )
    )

    (block $block (loop $loop
      (local.set $rem (i32.rem_s (local.get $large) (local.get $small)))
      (local.get $rem)
      (br_if $block (i32.eqz))
      
      (local.set $tmp (local.get $large))
      (local.set $large (local.get $small))
      (local.set $small (local.get $rem))
      (br $loop)
    ))

    (local.get $small)
  )
)