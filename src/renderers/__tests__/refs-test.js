/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @emails react-core
 */

'use strict';

var React = require('react');
var ReactDOMFeatureFlags = require('ReactDOMFeatureFlags');
var ReactTestUtils = require('react-dom/test-utils');

/**
 * Counts clicks and has a renders an item for each click. Each item rendered
 * has a ref of the form "clickLogN".
 */
class ClickCounter extends React.Component {
  state = {count: this.props.initialCount};

  triggerReset = () => {
    this.setState({count: this.props.initialCount});
  };

  handleClick = () => {
    this.setState({count: this.state.count + 1});
  };

  render() {
    var children = [];
    var i;
    for (i = 0; i < this.state.count; i++) {
      children.push(
        <div
          className="clickLogDiv"
          key={'clickLog' + i}
          ref={'clickLog' + i}
        />,
      );
    }
    return (
      <span className="clickIncrementer" onClick={this.handleClick}>
        {children}
      </span>
    );
  }
}

/**
 * Only purpose is to test that refs are tracked even when applied to a
 * component that is injected down several layers. Ref systems are difficult to
 * build in such a way that ownership is maintained in an airtight manner.
 */
class GeneralContainerComponent extends React.Component {
  render() {
    return <div>{this.props.children}</div>;
  }
}

/**
 * Notice how refs ownership is maintained even when injecting a component
 * into a different parent.
 */
class TestRefsComponent extends React.Component {
  doReset = () => {
    this.refs.myCounter.triggerReset();
  };

  render() {
    return (
      <div>
        <div ref="resetDiv" onClick={this.doReset}>
          Reset Me By Clicking This.
        </div>
        <GeneralContainerComponent ref="myContainer">
          <ClickCounter ref="myCounter" initialCount={1} />
        </GeneralContainerComponent>
      </div>
    );
  }
}

/**
 * Render a TestRefsComponent and ensure that the main refs are wired up.
 */
var renderTestRefsComponent = function() {
  var testRefsComponent = ReactTestUtils.renderIntoDocument(
    <TestRefsComponent />,
  );
  expect(testRefsComponent instanceof TestRefsComponent).toBe(true);

  var generalContainer = testRefsComponent.refs.myContainer;
  expect(generalContainer instanceof GeneralContainerComponent).toBe(true);

  var counter = testRefsComponent.refs.myCounter;
  expect(counter instanceof ClickCounter).toBe(true);

  return testRefsComponent;
};

var expectClickLogsLengthToBe = function(instance, length) {
  var clickLogs = ReactTestUtils.scryRenderedDOMComponentsWithClass(
    instance,
    'clickLogDiv',
  );
  expect(clickLogs.length).toBe(length);
  expect(Object.keys(instance.refs.myCounter.refs).length).toBe(length);
};

describe('reactiverefs', () => {
  beforeEach(() => {
    jest.resetModules();
    React = require('react');
    ReactTestUtils = require('react-dom/test-utils');
  });

  /**
   * Ensure that for every click log there is a corresponding ref (from the
   * perspective of the injected ClickCounter component.
   */
  it('Should increase refs with an increase in divs', () => {
    var testRefsComponent = renderTestRefsComponent();
    var clickIncrementer = ReactTestUtils.findRenderedDOMComponentWithClass(
      testRefsComponent,
      'clickIncrementer',
    );

    expectClickLogsLengthToBe(testRefsComponent, 1);

    // After clicking the reset, there should still only be one click log ref.
    ReactTestUtils.Simulate.click(testRefsComponent.refs.resetDiv);
    expectClickLogsLengthToBe(testRefsComponent, 1);

    // Begin incrementing clicks (and therefore refs).
    ReactTestUtils.Simulate.click(clickIncrementer);
    expectClickLogsLengthToBe(testRefsComponent, 2);

    ReactTestUtils.Simulate.click(clickIncrementer);
    expectClickLogsLengthToBe(testRefsComponent, 3);

    // Now reset again
    ReactTestUtils.Simulate.click(testRefsComponent.refs.resetDiv);
    expectClickLogsLengthToBe(testRefsComponent, 1);
  });
});

describe('factory components', () => {
  it('Should correctly get the ref', () => {
    function Comp() {
      return {
        render() {
          return <div ref="elemRef" />;
        },
      };
    }

    const inst = ReactTestUtils.renderIntoDocument(<Comp />);
    expect(inst.refs.elemRef.tagName).toBe('DIV');
  });
});

/**
 * Tests that when a ref hops around children, we can track that correctly.
 */
describe('ref swapping', () => {
  let RefHopsAround;
  beforeEach(() => {
    jest.resetModules();
    React = require('react');
    ReactTestUtils = require('react-dom/test-utils');

    RefHopsAround = class extends React.Component {
      state = {count: 0};

      moveRef = () => {
        this.setState({count: this.state.count + 1});
      };

      render() {
        var count = this.state.count;
        /**
         * What we have here, is three divs with refs (div1/2/3), but a single
         * moving cursor ref `hopRef` that "hops" around the three. We'll call the
         * `moveRef()` function several times and make sure that the hop ref
         * points to the correct divs.
         */
        return (
          <div>
            <div
              className="first"
              ref={count % 3 === 0 ? 'hopRef' : 'divOneRef'}
            />
            <div
              className="second"
              ref={count % 3 === 1 ? 'hopRef' : 'divTwoRef'}
            />
            <div
              className="third"
              ref={count % 3 === 2 ? 'hopRef' : 'divThreeRef'}
            />
          </div>
        );
      }
    };
  });

  it('Allow refs to hop around children correctly', () => {
    var refHopsAround = ReactTestUtils.renderIntoDocument(<RefHopsAround />);

    var firstDiv = ReactTestUtils.findRenderedDOMComponentWithClass(
      refHopsAround,
      'first',
    );
    var secondDiv = ReactTestUtils.findRenderedDOMComponentWithClass(
      refHopsAround,
      'second',
    );
    var thirdDiv = ReactTestUtils.findRenderedDOMComponentWithClass(
      refHopsAround,
      'third',
    );

    expect(refHopsAround.refs.hopRef).toEqual(firstDiv);
    expect(refHopsAround.refs.divTwoRef).toEqual(secondDiv);
    expect(refHopsAround.refs.divThreeRef).toEqual(thirdDiv);

    refHopsAround.moveRef();
    expect(refHopsAround.refs.divOneRef).toEqual(firstDiv);
    expect(refHopsAround.refs.hopRef).toEqual(secondDiv);
    expect(refHopsAround.refs.divThreeRef).toEqual(thirdDiv);

    refHopsAround.moveRef();
    expect(refHopsAround.refs.divOneRef).toEqual(firstDiv);
    expect(refHopsAround.refs.divTwoRef).toEqual(secondDiv);
    expect(refHopsAround.refs.hopRef).toEqual(thirdDiv);

    /**
     * Make sure that after the third, we're back to where we started and the
     * refs are completely restored.
     */
    refHopsAround.moveRef();
    expect(refHopsAround.refs.hopRef).toEqual(firstDiv);
    expect(refHopsAround.refs.divTwoRef).toEqual(secondDiv);
    expect(refHopsAround.refs.divThreeRef).toEqual(thirdDiv);
  });

  it('always has a value for this.refs', () => {
    class Component extends React.Component {
      render() {
        return <div />;
      }
    }

    var instance = ReactTestUtils.renderIntoDocument(<Component />);
    expect(!!instance.refs).toBe(true);
  });

  function testRefCall() {
    var refCalled = 0;
    function Inner(props) {
      return <a ref={props.saveA} />;
    }

    class Outer extends React.Component {
      saveA = () => {
        refCalled++;
      };

      componentDidMount() {
        this.setState({});
      }

      render() {
        return <Inner saveA={this.saveA} />;
      }
    }

    ReactTestUtils.renderIntoDocument(<Outer />);
    expect(refCalled).toBe(1);
  }

  it('ref called correctly for stateless component when __DEV__ = false', () => {
    var originalDev = __DEV__;
    __DEV__ = false;
    testRefCall();
    __DEV__ = originalDev;
  });

  it('ref called correctly for stateless component when __DEV__ = true', () => {
    var originalDev = __DEV__;
    __DEV__ = true;
    testRefCall();
    __DEV__ = originalDev;
  });

  it('coerces numbers to strings', () => {
    class A extends React.Component {
      render() {
        return <div ref={1} />;
      }
    }
    const a = ReactTestUtils.renderIntoDocument(<A />);
    expect(a.refs[1].nodeName).toBe('DIV');
  });
});

describe('string refs between fiber and stack', () => {
  beforeEach(() => {
    jest.resetModules();
    React = require('react');
    ReactTestUtils = require('react-dom/test-utils');
  });

  it('attaches, detaches from fiber component with stack layer', () => {
    const ReactCurrentOwner = require('ReactCurrentOwner');

    const ReactDOMStack = require('ReactDOMStackEntry');
    const ReactDOMFiber = require('ReactDOMFiberEntry');
    const ReactInstanceMap = require('ReactInstanceMap');
    let layerMounted = false;
    class A extends React.Component {
      render() {
        return <div />;
      }
      componentDidMount() {
        // ReactLayeredComponentMixin sets ReactCurrentOwner manually
        ReactCurrentOwner.current = ReactInstanceMap.get(this);
        const span = <span ref="span" />;
        ReactCurrentOwner.current = null;

        ReactDOMStack.unstable_renderSubtreeIntoContainer(
          this,
          span,
          (this._container = document.createElement('div')),
          () => {
            expect(this.refs.span.nodeName).toBe('SPAN');
            layerMounted = true;
          },
        );
      }
      componentWillUnmount() {
        ReactDOMStack.unmountComponentAtNode(this._container);
      }
    }
    const container = document.createElement('div');
    const a = ReactDOMFiber.render(<A />, container);
    expect(a.refs.span).toBeTruthy();
    ReactDOMFiber.unmountComponentAtNode(container);
    expect(a.refs.span).toBe(undefined);
    expect(layerMounted).toBe(true);
  });

  it('attaches, detaches from stack component with fiber layer', () => {
    const ReactCurrentOwner = require('ReactCurrentOwner');
    const ReactDOM = require('ReactDOMStackEntry');
    const ReactDOMFiber = require('ReactDOMFiberEntry');
    const ReactInstanceMap = require('ReactInstanceMap');
    let layerMounted = false;
    class A extends React.Component {
      render() {
        return <div />;
      }
      componentDidMount() {
        // ReactLayeredComponentMixin sets ReactCurrentOwner manually
        ReactCurrentOwner.current = ReactInstanceMap.get(this);
        const span = <span ref="span" />;
        ReactCurrentOwner.current = null;

        ReactDOMFiber.unstable_renderSubtreeIntoContainer(
          this,
          span,
          (this._container = document.createElement('div')),
          () => {
            expect(this.refs.span.nodeName).toBe('SPAN');
            layerMounted = true;
          },
        );
      }
      componentWillUnmount() {
        ReactDOMFiber.unmountComponentAtNode(this._container);
      }
    }
    const container = document.createElement('div');
    const a = ReactDOM.render(<A />, container);
    expect(a.refs.span).toBeTruthy();
    ReactDOM.unmountComponentAtNode(container);
    expect(a.refs.span).toBe(undefined);
    expect(layerMounted).toBe(true);
  });
});

describe('root level refs', () => {
  beforeEach(() => {
    var ReactFeatureFlags = require('ReactFeatureFlags');
    ReactFeatureFlags.disableNewFiberFeatures = false;
  });

  it('attaches and detaches root refs', () => {
    var ReactDOM = require('react-dom');
    var inst = null;

    // host node
    var ref = jest.fn(value => (inst = value));
    var container = document.createElement('div');
    var result = ReactDOM.render(<div ref={ref} />, container);
    expect(ref).toHaveBeenCalledTimes(1);
    expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLDivElement);
    expect(result).toBe(ref.mock.calls[0][0]);
    ReactDOM.unmountComponentAtNode(container);
    expect(ref).toHaveBeenCalledTimes(2);
    expect(ref.mock.calls[1][0]).toBe(null);

    // composite
    class Comp extends React.Component {
      method() {
        return true;
      }
      render() {
        return <div>Comp</div>;
      }
    }

    inst = null;
    ref = jest.fn(value => (inst = value));
    result = ReactDOM.render(<Comp ref={ref} />, container);

    expect(ref).toHaveBeenCalledTimes(1);
    expect(inst).toBeInstanceOf(Comp);
    expect(result).toBe(inst);

    // ensure we have the correct instance
    expect(result.method()).toBe(true);
    expect(inst.method()).toBe(true);

    ReactDOM.unmountComponentAtNode(container);
    expect(ref).toHaveBeenCalledTimes(2);
    expect(ref.mock.calls[1][0]).toBe(null);

    if (ReactDOMFeatureFlags.useFiber) {
      // fragment
      inst = null;
      ref = jest.fn(value => (inst = value));
      var divInst = null;
      var ref2 = jest.fn(value => (divInst = value));
      result = ReactDOM.render(
        [<Comp ref={ref} key="a" />, 5, <div ref={ref2} key="b">Hello</div>],
        container,
      );

      // first call should be `Comp`
      expect(ref).toHaveBeenCalledTimes(1);
      expect(ref.mock.calls[0][0]).toBeInstanceOf(Comp);
      expect(result).toBe(ref.mock.calls[0][0]);

      expect(ref2).toHaveBeenCalledTimes(1);
      expect(divInst).toBeInstanceOf(HTMLDivElement);
      expect(result).not.toBe(divInst);

      ReactDOM.unmountComponentAtNode(container);
      expect(ref).toHaveBeenCalledTimes(2);
      expect(ref.mock.calls[1][0]).toBe(null);
      expect(ref2).toHaveBeenCalledTimes(2);
      expect(ref2.mock.calls[1][0]).toBe(null);

      // null
      result = ReactDOM.render(null, container);
      expect(result).toBe(null);

      // primitives
      result = ReactDOM.render(5, container);
      expect(result).toBeInstanceOf(Text);
    }
  });
});

describe('creating element with ref in constructor', () => {
  class RefTest extends React.Component {
    constructor(props) {
      super(props);
      this.p = <p ref="p">Hello!</p>;
    }

    render() {
      return <div>{this.p}</div>;
    }
  }

  var devErrorMessage =
    'addComponentAsRefTo(...): Only a ReactOwner can have refs. You might ' +
    "be adding a ref to a component that was not created inside a component's " +
    '`render` method, or you have multiple copies of React loaded ' +
    '(details: https://fb.me/react-refs-must-have-owner).';

  var prodErrorMessage =
    'Minified React error #119; visit ' +
    'http://facebook.github.io/react/docs/error-decoder.html?invariant=119 for the full message ' +
    'or use the non-minified dev environment for full errors and additional helpful warnings.';

  var fiberDevErrorMessage =
    'Element ref was specified as a string (p) but no owner was ' +
    'set. You may have multiple copies of React loaded. ' +
    '(details: https://fb.me/react-refs-must-have-owner).';

  var fiberProdErrorMessage =
    'Minified React error #149; visit ' +
    'http://facebook.github.io/react/docs/error-decoder.html?invariant=149&args[]=p ' +
    'for the full message or use the non-minified dev environment for full errors and additional ' +
    'helpful warnings.';

  it('throws an error when __DEV__ = true', () => {
    ReactTestUtils = require('react-dom/test-utils');

    var originalDev = __DEV__;
    __DEV__ = true;

    try {
      expect(function() {
        ReactTestUtils.renderIntoDocument(<RefTest />);
      }).toThrowError(
        ReactDOMFeatureFlags.useFiber ? fiberDevErrorMessage : devErrorMessage,
      );
    } finally {
      __DEV__ = originalDev;
    }
  });

  it('throws an error when __DEV__ = false', () => {
    ReactTestUtils = require('react-dom/test-utils');

    var originalDev = __DEV__;
    __DEV__ = false;

    try {
      expect(function() {
        ReactTestUtils.renderIntoDocument(<RefTest />);
      }).toThrowError(
        ReactDOMFeatureFlags.useFiber
          ? fiberProdErrorMessage
          : prodErrorMessage,
      );
    } finally {
      __DEV__ = originalDev;
    }
  });
});
