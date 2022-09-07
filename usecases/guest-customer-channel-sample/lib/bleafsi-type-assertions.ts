// eslint-disable-next-line @typescript-eslint/ban-types
export function assertObject(path: string, x: unknown): object {
  if (x !== null && x !== undefined && typeof x == 'object') {
    return x;
  }
  throw Error(`${path} is not an object; found ${JSON.stringify(x)}`);
}
export function assertString(path: string, x: unknown): string {
  if (typeof x == 'string') {
    return x;
  }
  throw Error(`${path} is not a string; found ${JSON.stringify(x)}`);
}
export function assertBoolean(path: string, x: unknown): boolean {
  if (typeof x == 'boolean') {
    return x;
  }
  throw Error(`${path} is not a boolean; found ${JSON.stringify(x)}`);
}
export function assertArray<Elem>(
  elemAssert: (path: string, member: unknown) => Elem,
): (path: string, x: unknown) => Elem[] {
  return (path: string, x: unknown): Elem[] => {
    if (Array.isArray(x)) {
      x.forEach((val, index) => {
        const elemPath = `${path}[${index}]`;
        elemAssert(elemPath, val);
      });
      return x;
    }
    throw Error(`${path} is not an array; found ${JSON.stringify(x)}`);
  };
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function assertProperty<Obj extends object, Key extends string, T>(
  path: string,
  obj: Obj,
  key: Key,
  assertFunc: (path: string, member: unknown) => T,
): T {
  const memberPath = `${path}.${key}`;
  if (hasOwnProperty(obj, key)) {
    return assertFunc(memberPath, obj[key]);
  }
  throw Error(`${memberPath} was not found`);
}
// eslint-disable-next-line @typescript-eslint/ban-types
export function assertPropertyIfExists<Obj extends object, Key extends string, T>(
  path: string,
  obj: Obj,
  key: Key,
  assertFunc: (path: string, member: unknown) => T,
): T | undefined {
  const memberPath = `${path}.${key}`;
  if (hasOwnProperty(obj, key)) {
    return assertFunc(memberPath, obj[key]);
  }
  return undefined;
}
// eslint-disable-next-line @typescript-eslint/ban-types
export function hasOwnProperty<Obj extends object, Key extends string>(
  obj: Obj,
  key: Key,
): obj is Obj & Record<Key, unknown> {
  return Object.prototype.hasOwnProperty.call(obj, key);
}
