# Homebridge Gree AC Adapter

## Features

- Turning the Gree AC on or off
- Mode setting
- Temperature units setting
- Target temperature setting
- Current temperature display
- Setting the wind speed (setting it to 0, sets the AC to `Auto`; can only be set if both `Quiet` and `Turbo` are off)
- Setting the wind direction (switching from predefined fixed to predefined swinging and vice versa, both based on the
  current operating mode)
- Turning `Quiet` on or off (setting `Quiet` to on, sets `Turbo` to off, if it is set to on)
- Turning `Turbo` on or off (setting `Turbo` to on, sets `Quiet` to off, if it is set to on; can only be set to on if
  the current operating mode is not `Heat`)
- Turning `Light` on or off
- Turning `X-Fan` on or off
- Turning `Sleep` on or off
- Turning `Health` on or off

## Configuration

For an easier configuration process, check out [Homebridge Config UI X](https://github.com/oznu/homebridge-config-ui-x).
If you do not wish to use the previous method of configuring the plugin, you must manually edit the `config.json` file.
The following table shows the necessary properties, along with their recommended values and a short
description of what the property is for.

|        Key        | Default |                          Description                           |
|:-----------------:|:-------:|:--------------------------------------------------------------:|
|      `port`       | `7000`  |          Port used for communicating with the device.          |
|    `scanPort`     | `7000`  |              Port used for scanning for devices.               |
|   `scanAddress`   |         | The IPv4 address to be used for local network device scanning. |
|  `scanInterval`   | `1000`  |      Time in milliseconds between two consecutive scans.       |
| `scanMaxRetries`  |   `3`   |  Maximum number of retries before stopping the scan process.   |
| `refreshInterval` | `1000`  |  Time in milliseconds between device` status update requests.  |
|      `debug`      | `false` |                                                                |

## Limitations

- Because there are not supported by HAP Specification, the following modes are not available: `Dry`, `Fan`
- Temperature display units only affects and reflects the display and operating units on the device. HAP Specification
  clearly stands: *"Celsius is the only temperature unit in the HomeKit Accessory Protocol. Unit conversion is always
  done
  on the client side e.g. on the iPhone in the Home App depending on the configured unit on the device itself."*
- HAP Specification doesn't offer a way for fine-tuning the swinging (as the Gree remote and app do). Swing mode only
  describes if swinging is enabled or disabled. Such, predefined settings are used for both values of this
  characteristic,
  these predefined settings being adapted to the current operating mode.
- `Turbo` cannot be turned on if the current operating mode is `Heat`. This is a constraint of the Gree Air Conditioner
  itself.

## Gree Air Conditioner API

There are 2 ***message types*** for the communication between the implemented application and the Gree device:
1. `scan`
2. `pack`

There are 4 ***request types*** which can be sent to the Gree device:
1. `scan`
2. `bind`
3. `status`
4. `cmd`

There are 4 ***response types*** which can be received from the Gree device:
1. `dev`
2. `bindok`
3. `dat`
4. `res`

Each line in the following table shows the corresponding ***response type*** for each ***request type*** along with
their associated individual message types (***request message type*** and ***response message type***):

| Request<br/>Message Type | Request<br/>Type | Response<br/>Message Type | Response<br/>Type |
|:------------------------:|:----------------:|:-------------------------:|:-----------------:|
|          `scan`          |      `scan`      |          `pack`           |       `dev`       |
|          `pack`          |      `bind`      |          `pack`           |     `bindok`      |
|          `pack`          |     `status`     |          `pack`           |       `dat`       |
|          `pack`          |      `cmd`       |          `pack`           |       `res`       |

---

### Scanning for devices
* request (sent as a *broadcast* message to the local network)
```json
{
  "t": "scan"
}
```
* response
```json
{
  "t":    "pack",
  "i":    1,
  "uid":  0,
  "cid":  "<MAC>",
  "tcid": "",
  "pack": {
    "t":       "dev",
    "bc":      "gree",
    "brand":   "gree",
    "catalog": "gree",
    "cid":     "<MAC>",
    "mac":     "<MAC>",
    "mid":     "10001",
    "model":   "gree",
    "name":    "<FRIENDLY NAME>",
    "series":  "gree",
    "vendor":  "1",
    "ver":     "<VERSION>",
    "lock":    0
  }
}
```

---

### Binding to a device
* request
```json
{
  "t":    "pack",
  "i":    1,
  "uid":  0,
  "cid":  "app",
  "tcid": "<MAC>",
  "pack": {
    "t":   "bind",
    "uid": 0,
    "mac": "<MAC>"
  }
}
```
* response
```json
{
  "t":    "pack",
  "i":    1,
  "uid":  0,
  "cid":  "<MAC>",
  "tcid": "app",
  "pack": {
    "r":   200,
    "t":   "bindok",
    "mac": "<MAC>",
    "key": "<KEY>"
  }
}
```

---

### Requesting the status of a device
* request
```json
{
  "t":    "pack",
  "i":    0,
  "uid":  0,
  "cid":  "app",
  "tcid": "<MAC>",
  "pack": {
    "t":    "status",
    "mac":  "<MAC>",
    "cols": [
      "Pow",
      "Mod",
      "SetTem",
      "TemRec",
      "TemUn",
      "WdSpd",
      "SwingLfRig",
      "SwUpDn",
      "Blo",
      "Health",
      "Lig",
      "SwhSlp",
      "Quiet",
      "Tur",
      "StHt",
      "SvSt",
      "HeatCoolType"
    ]
  }
}
```
* response
```json
{
  "t":    "pack",
  "i":    0,
  "uid":  0,
  "cid":  "<MAC>",
  "tcid": "",
  "pack": {
    "r":    200,
    "t":    "dat",
    "mac":  "<MAC>",
    "cols": [
      "Pow",
      "Mod",
      "SetTem",
      "TemRec",
      "TemUn",
      "WdSpd",
      "SwingLfRig",
      "SwUpDn",
      "Blo",
      "Health",
      "Lig",
      "SwhSlp",
      "Quiet",
      "Tur",
      "StHt",
      "SvSt",
      "HeatCoolType"
    ],
    "dat":  [1, 1, 25, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0]
  }
}
```

---

### Sending commands to a device
* request
```json
{
  "t":    "pack",
  "i":    0,
  "uid":  0,
  "cid":  "app",
  "tcid": "<MAC>",
  "pack": {
    "t":   "cmd",
    "opt": ["Pow", "Mod", "SetTem", "WdSpd"],
    "p":   [1, 0, 27, 0]
  }
}
```
* response
```json
{
  "t":    "pack",
  "i":    0,
  "uid":  0,
  "cid":  "<MAC>",
  "tcid": "",
  "pack": {
    "r":   200,
    "t":   "res",
    "mac": "<MAC>",
    "opt": ["Pow", "Mod", "SetTem", "WdSpd"],
    "val": [1, 0, 27, 0],
    "p":   [1, 0, 27, 0]
  }
}
```

---

### Sending the target temperature in Fahrenheit

| Fahrenheit (F) | Celsius (C) | `TemSet` | `TemRec` |
|:--------------:|:-----------:|:--------:|:--------:|
|       61       |    16.1     |    16    |    1     |
|       62       |    16.7     |    17    |    0     |
|       63       |    17.2     |    17    |    1     |
|       64       |    17.8     |    18    |    0     |
|       65       |    18.3     |    18    |    1     |
|       66       |    18.9     |    19    |    0     |
|       67       |    19.4     |    19    |    1     |
|      *68*      |   *20.0*    |   *20*   |   *1*    |
|       69       |    20.6     |    21    |    0     |
|       70       |    21.1     |    21    |    1     |
|       71       |    21.7     |    22    |    0     |
|       72       |    22.2     |    22    |    1     |
|       73       |    22.8     |    23    |    0     |
|       74       |    23.3     |    23    |    1     |
|       75       |    23.9     |    24    |    0     |
|       76       |    24.4     |    24    |    1     |
|      *77*      |   *25.0*    |   *25*   |   *1*    |
|       78       |    25.6     |    26    |    0     |
|       79       |    26.1     |    26    |    1     |
|       80       |    26.7     |    27    |    0     |
|       81       |    27.2     |    27    |    1     |
|       82       |    27.8     |    28    |    0     |
|       83       |    28.3     |    28    |    1     |
|       84       |    28.9     |    29    |    0     |
|       85       |    29.4     |    29    |    1     |
|      *86*      |   *30.0*    |   *30*   |   *1*    |

`C = (F - 32.0) / 1.8`  
`TemSet = round(C)`  
`TemRec = (C - TemSet) < 0 ? 0 : 1`

---

### Reading the target temperature in Fahrenheit

| `TemSet` | `TemRec` | Fahrenheit (F1) | Fahrenheit (F2) |
|:--------:|:--------:|:---------------:|:---------------:|
|    16    |    1     |      60.8       |       61        |
|    17    |    0     |      62.6       |       62        |
|    17    |    1     |      62.6       |       63        |
|    18    |    0     |      64.4       |       64        |
|    18    |    1     |      64.4       |       65        |
|    19    |    0     |      66.2       |       66        |
|    19    |    1     |      66.2       |       67        |
|   *20*   |   *1*    |      *68*       |      *68*       |
|    21    |    0     |      69.8       |       69        |
|    21    |    1     |      69.8       |       70        |
|    22    |    0     |      71.6       |       71        |
|    22    |    1     |      71.6       |       72        |
|    23    |    0     |      73.4       |       73        |
|    23    |    1     |      73.4       |       74        |
|    24    |    0     |      75.2       |       75        |
|    24    |    1     |      75.2       |       76        |
|   *25*   |   *1*    |      *77*       |      *77*       |
|    26    |    0     |      78.8       |       78        |
|    26    |    1     |      78.8       |       79        |
|    27    |    0     |      80.6       |       80        |
|    27    |    1     |      80.6       |       81        |
|    28    |    0     |      82.4       |       82        |
|    28    |    1     |      82.4       |       83        |
|    29    |    0     |      84.2       |       84        |
|    29    |    1     |      84.2       |       85        |
|   *30*   |   *1*    |      *86*       |      *86*       |

`F1 = TemSet * 1.8 + 32`  
`F2 = (F1 % 1 == 0) ? F1 : (floor(F1) + TemRec)`
