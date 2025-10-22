import { applyDecorators, Type } from '@nestjs/common';
import { ApiOkResponse, ApiCreatedResponse, getSchemaPath } from '@nestjs/swagger';

export const ApiSuccessResponse = <TModel extends Type<any>>(model: TModel, isArray = false) => {
    return applyDecorators(
        ApiOkResponse({
            schema: isArray
                ? {
                      type: 'array',
                      items: { $ref: getSchemaPath(model) },
                  }
                : {
                      $ref: getSchemaPath(model),
                  },
        }),
    );
};

export const ApiCreatedSuccessResponse = <TModel extends Type<any>>(model: TModel) => {
    return applyDecorators(
        ApiCreatedResponse({
            schema: {
                $ref: getSchemaPath(model),
            },
        }),
    );
};
