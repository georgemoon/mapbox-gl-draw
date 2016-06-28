import test from 'tape';
import createSyntheticEvent from 'synthetic-dom-events';
import GLDraw from '../';
import createMap from './utils/create_map';
import mouseClick from './utils/mouse_click';
import makeMouseEvent from './utils/make_mouse_event';
import CommonSelectors from '../src/lib/common_selectors';
import drawPolygonMode from '../src/modes/draw_polygon';
import Polygon from '../src/feature_types/polygon';
import spy from 'sinon/lib/sinon/spy'; // avoid babel-register-related error by importing only spy

function createMockContext() {
  return {
    store: {
      add: spy(),
      delete: spy(),
      featureChanged: spy(),
      clearSelected: spy()
    },
    events: {
      changeMode: spy()
    },
    ui: {
      queueMapClasses: spy(),
      setActiveButton: spy()
    },
    map: {
      doubleClickZoom: {
        disable: spy(),
        enable: spy()
      }
    },
    _test: {}
  };
}

function createMockLifecycleContext() {
  return {
    on: spy()
  };
}

test('draw_polygon mode initialization', t => {
  const context = createMockContext();
  drawPolygonMode(context);

  t.equal(context.store.add.callCount, 1, 'store.add called');

  const emptyPolygon = new Polygon(context, {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[]]
    }
  });
  // Strip ids for this comparison
  t.deepEqual(Object.assign(context.store.add.getCall(0).args[0], { id: null }),
    Object.assign(emptyPolygon, { id: null }), 'with a new polygon');

  t.end();
});

test('draw_polygon start', t => {
  const context = createMockContext();
  const lifecycleContext = createMockLifecycleContext();
  const mode = drawPolygonMode(context);

  mode.start.call(lifecycleContext);
  t.equal(context.store.clearSelected.callCount, 1, 'store.clearSelected called');
  t.equal(context.ui.queueMapClasses.callCount, 1, 'ui.queueMapClasses called');
  t.deepEqual(context.ui.queueMapClasses.getCall(0).args, [{ mouse: 'add' }],
    'ui.queueMapClasses received correct arguments');
  t.equal(context.ui.setActiveButton.callCount, 1, 'ui.setActiveButton called');
  t.deepEqual(context.ui.setActiveButton.getCall(0).args, ['polygon'],
    'ui.setActiveButton received correct arguments');

  t.equal(lifecycleContext.on.callCount, 4, 'this.on called');
  t.ok(lifecycleContext.on.calledWith('mousemove', CommonSelectors.true));
  t.ok(lifecycleContext.on.calledWith('click', CommonSelectors.true));
  t.ok(lifecycleContext.on.calledWith('keyup', CommonSelectors.isEscapeKey));
  t.ok(lifecycleContext.on.calledWith('keyup', CommonSelectors.isEnterKey));

  setTimeout(() => {
    t.equal(context.map.doubleClickZoom.disable.callCount, 1);
    t.end();
  }, 10);
});

test('draw_polygon stop with valid polygon', t => {
  const context = createMockContext();
  const mode = drawPolygonMode(context);

  // Fake a valid polygon
  context._test.polygon.isValid = () => true;

  mode.stop.call();
  t.equal(context.ui.setActiveButton.callCount, 1, 'ui.setActiveButton called');
  t.deepEqual(context.ui.setActiveButton.getCall(0).args, [],
    'ui.setActiveButton received correct arguments');
  t.equal(context.store.delete.callCount, 0, 'store.delete not called');

  t.end();
});

test('draw_polygon stop with invalid polygon', t => {
  const context = createMockContext();
  const mode = drawPolygonMode(context);

  // Fake an invalid polygon
  context._test.polygon.isValid = () => false;

  mode.stop.call();
  t.equal(context.ui.setActiveButton.callCount, 1, 'ui.setActiveButton called');
  t.deepEqual(context.ui.setActiveButton.getCall(0).args, [],
    'ui.setActiveButton received correct arguments');
  t.equal(context.store.delete.callCount, 1, 'store.delete called');
  t.deepEqual(context.store.delete.getCall(0).args, [
    [context._test.polygon.id],
    { silent: true }
  ], 'store.delete received correct arguments');

  setTimeout(() => {
    t.equal(context.map.doubleClickZoom.enable.callCount, 1);
    t.end();
  }, 10);
});

test('draw_polygon render, active, with only two vertices', t => {
  const context = createMockContext();
  const mode = drawPolygonMode(context);

  const memo = [];
  const geojson = {
    type: 'Feature',
    properties: {
      id: context._test.polygon.id
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[[0, 0], [0, 10]]]
    }
  };
  mode.render(geojson, x => memo.push(x));
  t.equal(memo.length, 1);
  t.deepEqual(memo[0], {
    type: 'Feature',
    properties: {
      id: context._test.polygon.id,
      active: 'true',
      meta: 'feature'
    },
    geometry: {
      type: 'LineString',
      coordinates: [[0, 0], [0, 10]]
    }
  }, 'a line string is sent to the callback');
  t.end();
});

test('draw_polygon render, active', t => {
  const context = createMockContext();
  const mode = drawPolygonMode(context);

  const memo = [];
  const geojson = {
    type: 'Feature',
    properties: {
      id: context._test.polygon.id
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]]
    }
  };
  mode.render(geojson, x => memo.push(x));
  t.equal(memo.length, 1);
  t.deepEqual(memo[0], {
    type: 'Feature',
    properties: {
      id: context._test.polygon.id,
      active: 'true',
      meta: 'feature'
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]]
    }
  }, 'the polygon is sent to the callback');
  t.end();
});

test('draw_polygon render, inactive', t => {
  const context = createMockContext();
  const mode = drawPolygonMode(context);

  const memo = [];
  const geojson = {
    type: 'Feature',
    properties: {
      meta: 'meh'
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]]
    }
  };
  mode.render(geojson, x => memo.push(x));
  t.equal(memo.length, 1);
  t.deepEqual(memo[0], {
    type: 'Feature',
    properties: {
      active: 'false',
      meta: 'meh'
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]]
    }
  }, 'the polygon is sent to the callback');
  t.end();
});

test('draw_polygon render, no coordinates', t => {
  const context = createMockContext();
  const mode = drawPolygonMode(context);

  const memo = [];
  const geojson = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[]]
    }
  };
  mode.render(geojson, x => memo.push(x));
  t.equal(memo.length, 0);

  t.end();
});


test('draw_polygon interaction', t => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const map = createMap({ container });
  const Draw = GLDraw();
  map.addControl(Draw);

  map.on('load', () => {
    // The following sub-tests share state ...

    Draw.changeMode('draw_polygon');
    t.test('first click', st => {
      mouseClick(map, makeMouseEvent(10, 20));

      const { features } = Draw.getAll();
      st.equal(features.length, 1, 'polygon created');
      const polygon = Draw.getAll().features[0];
      st.equal(polygon.geometry.type, 'Polygon');

      st.deepEqual(polygon.geometry.coordinates, [[[10, 20], [10, 20]]], 'starting coordinate added');

      st.end();
    });

    t.test('move mouse', st => {
      map.fire('mousemove', makeMouseEvent(15, 23));
      const polygon = Draw.getAll().features[0];
      st.deepEqual(polygon.geometry.coordinates, [[[10, 20], [15, 23], [10, 20]]], 'middle coordinate added');
      st.end();
    });

    t.test('move mouse again', st => {
      map.fire('mousemove', makeMouseEvent(30, 33));
      const polygon = Draw.getAll().features[0];
      st.deepEqual(polygon.geometry.coordinates, [[[10, 20], [30, 33], [10, 20]]], 'middle coordinate replaced');
      st.end();
    });

    t.test('click to add another vertex', st => {
      mouseClick(map, makeMouseEvent(35, 35));
      const polygon = Draw.getAll().features[0];
      st.deepEqual(polygon.geometry.coordinates, [[[10, 20], [35, 35], [10, 20]]], 'middle coordinate replaced');
      st.end();
    });

    t.test('add more points then click on the last vertex to finish', st => {
      mouseClick(map, makeMouseEvent(40, 40));
      mouseClick(map, makeMouseEvent(50, 50));
      mouseClick(map, makeMouseEvent(55, 55));
      mouseClick(map, makeMouseEvent(55, 55));
      const polygon = Draw.getAll().features[0];
      st.deepEqual(polygon.geometry.coordinates,
        [[[10, 20], [35, 35], [40, 40], [50, 50], [55, 55], [10, 20]]],
        'all coordinates in place');

      mouseClick(map, makeMouseEvent(40, 40));
      st.deepEqual(polygon.geometry.coordinates,
        [[[10, 20], [35, 35], [40, 40], [50, 50], [55, 55], [10, 20]]],
        'since we exited draw_polygon mode, another click does not add a coordinate');

      st.end();
    });

    t.test('start a polygon but trash it before completion', st => {
      // Start a new polygon
      Draw.deleteAll();
      Draw.changeMode('draw_polygon');
      mouseClick(map, makeMouseEvent(1, 1));
      mouseClick(map, makeMouseEvent(2, 2));
      mouseClick(map, makeMouseEvent(3, 3));

      const polygon = Draw.getAll().features[0];
      st.deepEqual(polygon.geometry.coordinates, [[[1, 1], [2, 2], [3, 3], [1, 1]]]);

      Draw.trash();
      st.equal(Draw.getAll().features.length, 0, 'no feature added');

      mouseClick(map, makeMouseEvent(1, 1));
      st.equal(Draw.getAll().features.length, 0, 'no longer drawing');

      st.end();
    });

    t.test('start a polygon but trash it with Escape before completion', st => {
      // Start a new polygon
      Draw.deleteAll();
      Draw.changeMode('draw_polygon');
      mouseClick(map, makeMouseEvent(1, 1));
      mouseClick(map, makeMouseEvent(2, 2));
      mouseClick(map, makeMouseEvent(3, 3));

      const polygon = Draw.getAll().features[0];
      st.deepEqual(polygon.geometry.coordinates, [[[1, 1], [2, 2], [3, 3], [1, 1]]]);

      const escapeEvent = createSyntheticEvent('keyup', {
        keyCode: 27
      });
      container.dispatchEvent(escapeEvent);

      st.equal(Draw.getAll().features.length, 0, 'no feature added');

      mouseClick(map, makeMouseEvent(1, 1));
      st.equal(Draw.getAll().features.length, 0, 'no longer drawing');

      st.end();
    });

    t.test('start a polygon and end it with Enter', st => {
      // Start a new polygon
      Draw.deleteAll();
      Draw.changeMode('draw_polygon');
      mouseClick(map, makeMouseEvent(1, 1));
      mouseClick(map, makeMouseEvent(2, 2));
      mouseClick(map, makeMouseEvent(3, 3));

      const polygon = Draw.getAll().features[0];
      st.deepEqual(polygon.geometry.coordinates, [[[1, 1], [2, 2], [3, 3], [1, 1]]]);

      const enterEvent = createSyntheticEvent('keyup', {
        keyCode: 13
      });
      container.dispatchEvent(enterEvent);

      st.equal(Draw.getAll().features.length, 1, 'the feature was added');
      st.deepEqual(Draw.getAll().features[0].geometry.coordinates, [[[1, 1], [2, 2], [3, 3], [1, 1]]], 'the polygon is correct');

      mouseClick(map, makeMouseEvent(1, 1));
      st.equal(Draw.getAll().features.length, 1, 'no longer drawing');

      st.end();
    });

    t.test('start draw_polygon mode then exit before a click', st => {
      Draw.deleteAll();
      st.equal(Draw.getAll().features.length, 0, 'no features yet');

      Draw.changeMode('draw_polygon');
      st.equal(Draw.getAll().features.length, 1, 'polygon is added');
      let polygon = Draw.getAll().features[0];
      st.deepEqual(polygon.geometry.type, 'Polygon');

      Draw.changeMode('simple_select');
      st.equal(Draw.getAll().features.length, 0, 'polygon is removed');

      st.end();
    });

    document.body.removeChild(container);
    t.end();
  });
});
