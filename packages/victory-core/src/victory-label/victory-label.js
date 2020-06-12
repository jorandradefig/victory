import React from "react";
import PropTypes from "prop-types";
import VictoryPortal from "../victory-portal/victory-portal";
import Rect from "../victory-primitives/rect";
import CustomPropTypes from "../victory-util/prop-types";
import Helpers from "../victory-util/helpers";
import LabelHelpers from "../victory-util/label-helpers";
import Style from "../victory-util/style";
import Log from "../victory-util/log";
import TextSize from "../victory-util/textsize";
import TSpan from "../victory-primitives/tspan";
import Text from "../victory-primitives/text";
import { assign, defaults, isEmpty, maxBy, sumBy } from "lodash";

const defaultStyles = {
  fill: "#252525",
  fontSize: 14,
  fontFamily: "'Gill Sans', 'Gill Sans MT', 'Ser­avek', 'Trebuchet MS', sans-serif",
  stroke: "transparent"
};

const getPosition = (props, dimension) => {
  if (!props.datum) {
    return 0;
  }
  const scaledPoint = Helpers.scalePoint(props, props.datum);
  return scaledPoint[dimension];
};

const getFontSize = (style) => {
  const baseSize = style && style.fontSize;
  if (typeof baseSize === "number") {
    return baseSize;
  } else if (baseSize === undefined || baseSize === null) {
    return defaultStyles.fontSize;
  } else if (typeof baseSize === "string") {
    const fontSize = +baseSize.replace("px", "");
    if (!isNaN(fontSize)) {
      return fontSize;
    } else {
      Log.warn("fontSize should be expressed as a number of pixels");
      return defaultStyles.fontSize;
    }
  }
  return defaultStyles.fontSize;
};

const getStyles = (style, props) => {
  const getSingleStyle = (s) => {
    s = s ? defaults({}, s, defaultStyles) : defaultStyles;
    const baseStyles = Helpers.evaluateStyle(s, props);
    return assign({}, baseStyles, { fontSize: getFontSize(baseStyles) });
  };

  return Array.isArray(style) && !isEmpty(style)
    ? style.map((s) => getSingleStyle(s))
    : [getSingleStyle(style)];
};

const getHeight = (props, type) => {
  return Helpers.evaluateProp(props[type], props);
};

const getContent = (text, props) => {
  if (text === undefined || text === null) {
    return undefined;
  }
  if (Array.isArray(text)) {
    return text.map((line) => Helpers.evaluateProp(line, props));
  }
  const child = Helpers.evaluateProp(text, props);
  if (child === undefined || child === null) {
    return undefined;
  }
  return Array.isArray(child) ? child : `${child}`.split("\n");
};

const checkLineHeight = (lineHeight, val, fallbackVal) => {
  if (Array.isArray(lineHeight)) {
    return isEmpty(lineHeight) ? fallbackVal : val;
  }
  return lineHeight;
};

const getDy = (props, lineHeight) => {
  const style = Array.isArray(props.style) ? props.style[0] : props.style;
  lineHeight = checkLineHeight(lineHeight, lineHeight[0], 1);
  const fontSize = style.fontSize;
  const dy = props.dy ? Helpers.evaluateProp(props.dy, props) : 0;
  const length = props.inline ? 1 : props.text.length;
  const capHeight = getHeight(props, "capHeight");
  const verticalAnchor = style.verticalAnchor || props.verticalAnchor;
  const anchor = verticalAnchor ? Helpers.evaluateProp(verticalAnchor, props) : "middle";
  switch (anchor) {
    case "end":
      return dy + (capHeight / 2 + (0.5 - length) * lineHeight) * fontSize;
    case "middle":
      return dy + (capHeight / 2 + (0.5 - length / 2) * lineHeight) * fontSize;
    default:
      return dy + (capHeight / 2 + lineHeight / 2) * fontSize;
  }
};

const getTransform = (props) => {
  const { x, y, polar, style } = props;
  const defaultAngle = polar ? LabelHelpers.getPolarAngle(props) : 0;
  const baseAngle = style.angle === undefined ? props.angle : style.angle;
  const angle = baseAngle === undefined ? defaultAngle : baseAngle;
  const transform = props.transform || style.transform;
  const transformPart = transform && Helpers.evaluateProp(transform, props);
  const rotatePart = angle && { rotate: [angle, x, y] };
  return transformPart || angle ? Style.toTransformString(transformPart, rotatePart) : undefined;
};

const getBackgroundPadding = (padding) => {
  return typeof padding === "object" && padding !== null
    ? padding
    : { top: padding, bottom: padding, left: padding, right: padding };
};

const getXCoordinate = (calculatedProps, labelSizeWidth) => {
  const { direction, textAnchor, x } = calculatedProps;

  if (direction === "rtl") {
    return x - labelSizeWidth;
  }

  switch (textAnchor) {
    case "start":
      return x;
    case "middle":
      return Math.round(x - labelSizeWidth / 2);
    case "end":
      return Math.round(x - labelSizeWidth);
    default:
      return x;
  }
};

const getYCoordinate = (calculatedProps, props, textHeight) => {
  const { verticalAnchor, y } = calculatedProps;
  const { dy, inline } = props;
  const offset = y + (dy || 0);

  switch (verticalAnchor) {
    case "start":
      return Math.floor(offset);
    case "middle":
      return Math.floor(offset - textHeight / 2);
    case "end":
      return inline ? Math.floor(offset) : Math.ceil(offset - textHeight);
    default:
      return inline ? Math.floor(offset) : Math.floor(offset - textHeight / 2);
  }
};

const getBlockTextHeight = (props, adjustedLineHeight, capHeightsPx) => {
  const { text, style } = props;
  const styledFontHeight = sumBy(style, (s) => s.fontSize);

  return text.length > style.length
    ? styledFontHeight * adjustedLineHeight +
        capHeightsPx +
        defaultStyles.fontSize * adjustedLineHeight * (text.length - style.length)
    : styledFontHeight * adjustedLineHeight + capHeightsPx;
};

const getFullBackground = (props, calculatedProps) => {
  const { backgroundComponent, backgroundStyle, capHeight, inline, style, text } = props;
  const { dx, lineHeight, padding } = calculatedProps;
  const maxString = text.reduce((a, b) => (a.length > b.length ? a : b));
  const maxFontSize = maxBy(style, (s) => s.fontSize).fontSize;
  const adjustedLineHeight = checkLineHeight(lineHeight, lineHeight[0], 1);
  const capHeightsPx = TextSize.convertLengthToPixels(`${capHeight}em`, maxFontSize);
  const textHeight = inline
    ? maxFontSize * adjustedLineHeight + capHeightsPx
    : getBlockTextHeight(props, adjustedLineHeight, capHeightsPx);
  const width = inline
    ? TextSize.approximateTextSize(text.join(" "), style).width + (dx || 0) * text.length
    : TextSize.approximateTextSize(maxString, style).width + (dx || 0);
  const xCoordinate = getXCoordinate(calculatedProps, width);
  const yCoordinate = getYCoordinate(calculatedProps, props, textHeight);
  const transform = getTransform(props);

  const backgroundProps = {
    height: textHeight + ((padding && padding.top) || 0) + ((padding && padding.bottom) || 0),
    style: backgroundStyle,
    transform,
    width: width + ((padding && padding.left) || 0) + ((padding && padding.right) || 0),
    x: xCoordinate,
    y: yCoordinate
  };

  return React.cloneElement(
    backgroundComponent,
    defaults({}, backgroundComponent.props, backgroundProps)
  );
};

const getChildBackgrounds = (props, calculatedProps) => {
  const { backgroundStyle, backgroundComponent, capHeight, inline, text, style, y } = props;
  const { dy, lineHeight, padding } = calculatedProps;

  const textElement = text.map((line, i) => {
    const currentStyle = style[i] || style[0];
    const previousStyle = style[i - 1] || style[0];
    const previousLineHeight = checkLineHeight(lineHeight, lineHeight[i - 1] || 0, 1);
    const adjustedLineHeight = checkLineHeight(lineHeight, lineHeight[i], 1);
    const labelSize = TextSize.approximateTextSize(line, currentStyle);
    const capHeightPx = TextSize.convertLengthToPixels(`${capHeight}em`, currentStyle.fontSize);
    const prevCapHeightPx = TextSize.convertLengthToPixels(
      `${capHeight}em`,
      previousStyle.fontSize
    );
    const totalLineHeight = currentStyle.fontSize * adjustedLineHeight;
    const textHeight = Math.ceil(totalLineHeight);
    const prevPaddingProp = Array.isArray(padding) && padding[i - 1] ? padding[i - 1] : padding;

    return {
      textHeight,
      labelSize,
      y,
      fontSize: style.fontSize || defaultStyles.fontSize,
      dy:
        i && !inline
          ? Math.floor(previousStyle.fontSize * previousLineHeight) + (prevPaddingProp.top || 0) + (prevPaddingProp.bottom || 0)
          : Math.floor(dy - totalLineHeight * 0.5 - (currentStyle.fontSize - capHeightPx))
    };
  });

  const backgroundStyleChildren = backgroundStyle.map((bgStyle, i) => {
    const xCoordinate = getXCoordinate(calculatedProps, textElement[i].labelSize.width);
    const yCoordinate = textElement.slice(0, i + 1).reduce((prev, curr) => {
      return prev + curr.dy;
    }, y);
    const transform = getTransform(props);
    const paddingProp = Array.isArray(padding) && padding[i] ? padding[i] : padding;

    const backgroundProps = {
      key: `bgKey-${i}`,
      height: textElement[i].textHeight + (paddingProp.top || 0) + (paddingProp.bottom || 0),
      style: bgStyle,
      width: textElement[i].labelSize.width + (paddingProp.left || 0) + (paddingProp.right || 0),
      transform,
      x: xCoordinate,
      y: yCoordinate
    };

    return React.cloneElement(
      backgroundComponent,
      defaults({}, backgroundComponent.props, backgroundProps)
    );
  });

  return backgroundStyleChildren;
};

const getBackgroundElement = (props, calculatedProps) => {
  return Array.isArray(props.backgroundStyle)
    ? getChildBackgrounds(props, calculatedProps)
    : getFullBackground(props, calculatedProps);
};

const getTSpanDy = (
  previousFontSize,
  previousLineHeight,
  fontSize,
  lineHeight,
  prevCapHeightPx,
  capHeightPx,
  padding,
  prevPadding
) => {
  return Math.floor(
    -0.5 * previousFontSize -
      0.5 * (previousFontSize * previousLineHeight) +
      previousFontSize * previousLineHeight +
      (prevPadding.top || 0) + (prevPadding.bottom || 0) +
      0.5 * fontSize +
      0.5 * fontSize * lineHeight -
      (fontSize - capHeightPx) * 0.5 +
      (previousFontSize - prevCapHeightPx) * 0.5
  );
};

const renderTextElements = (props, calculatedProps) => {
  const { inline, capHeight, className, title, events, direction, text, style } = props;
  const { lineHeight, textAnchor, dx, dy, padding, transform, x, y } = calculatedProps;

  const textChildren = text.map((line, i) => {
    const currentStyle = style[i] || style[0];
    const lastStyle = style[i - 1] || style[0];
    const prevCapHeightPx = TextSize.convertLengthToPixels(`${capHeight}em`, lastStyle.fontSize);
    const capHeightPx = TextSize.convertLengthToPixels(`${capHeight}em`, currentStyle.fontSize);
    const paddingProp = Array.isArray(padding) && padding[i] ? padding[i] : padding;
    const prevPaddingProp = Array.isArray(padding) && padding[i - 1] ? padding[i - 1] : padding;

    const tspanProps = {
      key: `${props.id}-key-${i}`,
      x: !inline ? props.x : undefined,
      dx: dx + (paddingProp.left || 0),
      dy: i && !inline
        ? getTSpanDy(
            lastStyle.fontSize || defaultStyles.fontSize,
            lineHeight[i - 1] || 1,
            currentStyle.fontSize || defaultStyles.fontSize,
            lineHeight[i] || 1,
            prevCapHeightPx,
            capHeightPx,
            paddingProp,
            prevPaddingProp
          )
        : dy + (paddingProp.top || 0),
      textAnchor: currentStyle.textAnchor || textAnchor,
      style: currentStyle,
      children: line
    };
    return React.cloneElement(props.tspanComponent, tspanProps);
  });

  return React.cloneElement(
    props.textComponent,
    {
      ...events,
      direction,
      dx,
      dy,
      x,
      y,
      transform,
      className,
      title,
      desc: Helpers.evaluateProp(props.desc, props),
      tabIndex: Helpers.evaluateProp(props.tabIndex, props),
      id: props.id
    },
    textChildren
  );
};

const evaluateProps = (props) => {
  /* Potential evaluated props are
    1) text
    2) style
    3) everything else
  */
  const text = getContent(props.text, props);
  const style = getStyles(props.style, assign({}, props, { text }));
  const id = Helpers.evaluateProp(props.id, props);
  return assign({}, props, { style, text, id });
};

const getCalculatedProps = (props) => {
  const lineHeight = getHeight(props, "lineHeight");
  const direction = props.direction ? Helpers.evaluateProp(props.direction, props) : "inherit";
  const textAnchor = props.textAnchor ? Helpers.evaluateProp(props.textAnchor, props) : "start";
  const verticalAnchor = props.verticalAnchor
    ? Helpers.evaluateProp(props.verticalAnchor, props)
    : "middle";
  const dx = props.dx ? Helpers.evaluateProp(props.dx, props) : 0;
  const dy = getDy(props, lineHeight);
  const transform = getTransform(props);
  const x = props.x !== undefined ? props.x : getPosition(props, "x");
  const y = props.y !== undefined ? props.y : getPosition(props, "y");
  const padding = props.backgroundPadding
    ? Array.isArray(props.backgroundPadding)
      ? props.backgroundPadding.map((val) => getBackgroundPadding(val))
      : getBackgroundPadding(props.backgroundPadding)
    : {};

  return { lineHeight, direction, textAnchor, verticalAnchor, dx, dy, padding, transform, x, y };
};

const VictoryLabel = (props) => {
  props = evaluateProps(props);

  if (props.text === null || props.text === undefined) {
    return null;
  }
  const calculatedProps = getCalculatedProps(props);
  const label = renderTextElements(props, calculatedProps);

  if (props.backgroundStyle) {
    const backgroundElement = getBackgroundElement(props, calculatedProps);
    const children = [backgroundElement, label];
    const backgroundWithLabel = React.cloneElement(props.groupComponent, {}, children);

    return props.renderInPortal ? (
      <VictoryPortal>{backgroundWithLabel}</VictoryPortal>
    ) : (
      backgroundWithLabel
    );
  }

  return props.renderInPortal ? <VictoryPortal>{label}</VictoryPortal> : label;
};

VictoryLabel.displayName = "VictoryLabel";
VictoryLabel.role = "label";
VictoryLabel.defaultStyles = defaultStyles;
VictoryLabel.propTypes = {
  active: PropTypes.bool,
  angle: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  backgroundComponent: PropTypes.element,
  backgroundPadding: PropTypes.oneOfType([PropTypes.number, PropTypes.object, PropTypes.array]),
  backgroundStyle: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  capHeight: PropTypes.oneOfType([PropTypes.string, CustomPropTypes.nonNegative, PropTypes.func]),
  className: PropTypes.string,
  data: PropTypes.array,
  datum: PropTypes.any,
  desc: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  direction: PropTypes.oneOf(["rtl", "ltr", "inherit"]),
  dx: PropTypes.oneOfType([PropTypes.number, PropTypes.string, PropTypes.func]),
  dy: PropTypes.oneOfType([PropTypes.number, PropTypes.string, PropTypes.func]),
  events: PropTypes.object,
  groupComponent: PropTypes.element,
  id: PropTypes.oneOfType([PropTypes.number, PropTypes.string, PropTypes.func]),
  index: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  inline: PropTypes.bool,
  labelPlacement: PropTypes.oneOf(["parallel", "perpendicular", "vertical"]),
  lineHeight: PropTypes.oneOfType([
    PropTypes.string,
    CustomPropTypes.nonNegative,
    PropTypes.func,
    PropTypes.array
  ]),
  origin: PropTypes.shape({
    x: CustomPropTypes.nonNegative,
    y: CustomPropTypes.nonNegative
  }),
  polar: PropTypes.bool,
  renderInPortal: PropTypes.bool,
  scale: PropTypes.shape({
    x: CustomPropTypes.scale,
    y: CustomPropTypes.scale
  }),
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  tabIndex: PropTypes.oneOfType([PropTypes.number, PropTypes.func]),
  text: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.func, PropTypes.array]),
  textAnchor: PropTypes.oneOfType([
    PropTypes.oneOf(["start", "middle", "end", "inherit"]),
    PropTypes.func
  ]),
  textComponent: PropTypes.element,
  title: PropTypes.string,
  transform: PropTypes.oneOfType([PropTypes.string, PropTypes.object, PropTypes.func]),
  tspanComponent: PropTypes.element,
  verticalAnchor: PropTypes.oneOfType([
    PropTypes.oneOf(["start", "middle", "end"]),
    PropTypes.func
  ]),
  x: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  y: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
};

VictoryLabel.defaultProps = {
  backgroundComponent: <Rect />,
  groupComponent: <g />,
  direction: "inherit",
  textComponent: <Text />,
  tspanComponent: <TSpan />,
  capHeight: 0.71, // Magic number from d3.
  lineHeight: 1
};

export default VictoryLabel;
