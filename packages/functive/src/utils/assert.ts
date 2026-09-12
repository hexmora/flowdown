import { isError } from 'lodash-es';

export class AssertError extends Error {
  name = 'assert_error';
}

type Assert = (value: unknown, message?: string) => asserts value;

export const assert: Assert = (value, message) => {
  if (!value) {
    if (isError(message)) {
      throw message;
    }

    throw new AssertError(message);
  }
};
