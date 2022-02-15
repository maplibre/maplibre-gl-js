import './stub_loader';
import canvas from 'canvas';
import {runRenderTests} from './render';

const {registerFont} = canvas;

registerFont('./node_modules/npm-font-open-sans/fonts/Bold/OpenSans-Bold.ttf', {family: 'Open Sans', weight: 'bold'});

runRenderTests();
