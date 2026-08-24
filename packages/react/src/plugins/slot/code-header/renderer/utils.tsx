import type { ComponentType, ReactNode } from 'react';

import { isFunction } from 'lodash-es';
import { createElement, Fragment } from 'react';

import type { CodeHeaderAction } from '../../../../types';

const isComponentType = (target: ComponentType | ReactNode): target is ComponentType =>
  isFunction(target);

export const renderAction = ({ key, target }: CodeHeaderAction) => (
  <Fragment key={key}>{isComponentType(target) ? createElement(target) : target}</Fragment>
);
