//@formatter:off

interface DeviceContext {
    mac:     string,
    address: string,
    brand:   string,
    model:   string,
    name:    string,
    version: string
}

type Pow        = 0 | 1;
type Mod        = 0 | 1 | 2 | 3 | 4;
type SetTem     = number;
type TemRec     = number;
type TemSen     = number;
type TemUn      = 0 | 1;
type WdSpd      = 0 | 1 | 2 | 3 | 4 | 5;
type SwingLfRig = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type SwUpDn     = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
type Blo        = 0 | 1;
type Health     = 0 | 1;
type Lig        = 0 | 1;
type SwhSlp     = 0 | 1;
type Quiet      = 0 | 1;
type Tur        = 0 | 1;

class DeviceStatus {
    public Pow:          Pow        | undefined;
    public Mod:          Mod        | undefined;
    public SetTem:       SetTem     | undefined;
    public TemRec:       TemRec     | undefined;
    public TemSen:       TemSen     | undefined;
    public TemUn:        TemUn      | undefined;
    public WdSpd:        WdSpd      | undefined;
    public SwingLfRig:   SwingLfRig | undefined;
    public SwUpDn:       SwUpDn     | undefined;
    public Blo:          Blo        | undefined;
    public Health:       Health     | undefined;
    public Lig:          Lig        | undefined;
    public SwhSlp:       SwhSlp     | undefined;
    public Quiet:        Quiet      | undefined;
    public Tur:          Tur        | undefined;
}

//@formatter:on