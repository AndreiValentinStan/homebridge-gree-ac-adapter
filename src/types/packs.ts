//@formatter:off

interface Pack {
    t: string
}

interface DevPack extends Pack {
    bc:      string,
    brand:   string,
    catalog: string,
    cid:     string,
    mac:     string,
    mid:     string,
    model:   string,
    name:    string,
    series:  string,
    vendor:  string,
    ver:     string,
    lock:    number
}

//region Request Packs
interface RequestPack extends Pack {
}
interface BindPack extends RequestPack {
    uid: number,
    mac: string
}
interface StatusPack extends RequestPack {
    mac:  string,
    cols: string[]
}
interface CmdPack extends RequestPack {
    opt: string[],
    p:   number[]
}
//endregion

//region Response Packs
interface ResponsePack extends Pack {
    r:   number,
    mac: string
}
interface BindOkPack extends ResponsePack {
    key: string
}
interface DatPack extends ResponsePack {
    cols: string[],
    dat:  number[]
}
interface ResPack extends ResponsePack {
    opt: string[],
    val: number[],
    p:   number[]
}
//endregion

//@formatter:on