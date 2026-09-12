import type { ComponentType, CSSProperties } from 'react';

import { get, has, keys } from 'lodash-es';
import { createElement, memo } from 'react';
import { shallowEqual } from 'shallow-equal';

import type { SlotInputProps, SlotType } from '../type';

import { EO } from '../../consts';
import { SlotRenderer } from '../components';

type StyleProps = {
  style?: CSSProperties;
};

const isSlotPropsEqual = (left: StyleProps, right: StyleProps): boolean => {
  if (left === right) {
    return true;
  }

  const leftKeys = keys(left);

  const rightKeys = keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  for (const key of leftKeys) {
    if (!has(right, key)) {
      return false;
    }

    if (key === 'style') {
      if (!shallowEqual(left.style ?? EO, right.style ?? EO)) {
        return false;
      }

      continue;
    }

    if (get(left, key) !== get(right, key)) {
      return false;
    }
  }

  return true;
};

export const createTypeOfSlot = <T extends SlotType>(type: T): ComponentType<SlotInputProps<T>> => {
  const TypeOfSlot = (props: SlotInputProps<T>) => createElement(SlotRenderer, { props, type });

  TypeOfSlot.displayName = `FluxdownTypeOfSlot(${type})`;

  return memo<SlotInputProps<T>>(TypeOfSlot, isSlotPropsEqual);
};
