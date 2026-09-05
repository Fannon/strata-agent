declare const console: { log(...values: unknown[]): void };
declare module "@cap/fixture" {
namespace Op0 {
export interface Input0 {}

export interface Output0 {
  count: number;
}

}
namespace Op1 {
export interface Input1 {
  country: "DE" | "US";
  filters?: {
    status?: "active" | "inactive";
    limit?: number;
  };
}

export interface Output1 {
  customers: {
    id: string;
    country: string;
  }[];
}

}
namespace Op2 {
export interface Input2 {}

export interface Output2 {
  deleted: boolean;
}

}
namespace Op3 {
export interface Input3 {
  customerIds: string[];
}

export interface Output3 {
  invoices: {
    id: string;
    customerId: string;
    amount: number;
  }[];
}

}
namespace Op4 {
export interface Input4 {
  count: number;
}

export interface Output4 {
  records: {
    id: number;
    score: number;
    text: string;
  }[];
}

}
namespace Op5 {
export interface Input5 {}

export interface Output5 {
  done: boolean;
}

}
namespace Op6 {
export interface Input6 {}

export interface Output6 {
  invocations: number;
}

}
namespace Op7 {
export interface Input7 {}


}
export const api: {
/**  */
"broken"(input: Op0.Input0): Promise<Op0.Output0>;
/** Search customers by country. Optional nested filters. */
"customers"(input: Op1.Input1): Promise<Op1.Output1>;
/**  */
"deleteAll"(input: Op2.Input2): Promise<Op2.Output2>;
/**  */
"invoices"(input: Op3.Input3): Promise<Op3.Output3>;
/**  */
"records"(input: Op4.Input4): Promise<Op4.Output4>;
/**  */
"slow"(input: Op5.Input5): Promise<Op5.Output5>;
/**  */
"stats"(input: Op6.Input6): Promise<Op6.Output6>;
/** Legacy text result; no structured output guarantee. */
"untyped"(input: Op7.Input7): Promise<unknown>;
};
}
