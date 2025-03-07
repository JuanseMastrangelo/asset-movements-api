import 'reflect-metadata';

export const EXCLUDE_FIELD_KEY = 'exclude_fields';

export function Exclude(): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const existingFields: string[] =
      Reflect.getMetadata(EXCLUDE_FIELD_KEY, target.constructor) || [];

    if (!existingFields.includes(propertyKey.toString())) {
      existingFields.push(propertyKey.toString());
    }

    Reflect.defineMetadata(
      EXCLUDE_FIELD_KEY,
      existingFields,
      target.constructor,
    );
  };
}
