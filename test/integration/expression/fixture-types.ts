export type ExpressionFixture = {
    expression: any[];
    inputs:any[];
    expected: {
        compiled?: {
            result?: any;
            isFeatureConstant?: any;
            isZoomConstant?: any;
            type?: any;
        };
        outputs? : any;
        serialized?: any;
    };
}

